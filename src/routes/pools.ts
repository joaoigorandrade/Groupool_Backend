import { FastifyInstance } from "fastify";
import { and, asc, eq, gt, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/index.js";
import { pools } from "../db/schema.js";
import { requireGroupMember } from "../middleware/requireGroupMember.js";

const poolParamsSchema = z.object({
  groupId: z.uuid(),
  poolId: z.uuid(),
});

const groupParamsSchema = z.object({
  groupId: z.uuid(),
});

const createPoolBodySchema = z.object({
  title: z.string().trim().min(1).max(120),
  targetCents: z.number().int().min(1),
  deadline: z.iso.datetime({ offset: true }).optional(),
});

const closePoolBodySchema = z.object({
  status: z.enum(["closed", "cancelled"]),
});

const listPoolsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().optional(),
});

interface PoolCursor {
  createdAt: string;
  id: string;
}

function encodeCursor(createdAt: Date, id: string): string {
  return Buffer.from(JSON.stringify({ createdAt: createdAt.toISOString(), id })).toString("base64url");
}

function decodeCursor(cursor: string): PoolCursor {
  try {
    return JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as PoolCursor;
  } catch {
    throw new Error("Invalid cursor");
  }
}

type PoolRecord = typeof pools.$inferSelect;

function toPoolResponse(pool: PoolRecord) {
  return {
    id: pool.id,
    groupId: pool.groupId,
    title: pool.title,
    targetCents: pool.targetCents,
    collectedCents: pool.collectedCents,
    status: pool.status,
    deadline: pool.deadline,
    createdAt: pool.createdAt,
  };
}

export async function poolRoutes(app: FastifyInstance) {
  app.post("/groups/:groupId/pools", {
    preHandler: [requireGroupMember],
  }, async (request, reply) => {
    const params = groupParamsSchema.parse(request.params);
    const body = createPoolBodySchema.parse(request.body);

    if (request.groupMember?.role !== "owner") {
      return reply.status(403).send({
        error: "forbidden",
        message: "Only the group owner can create a pool",
      });
    }

    const [pool] = await db
      .insert(pools)
      .values({
        groupId: params.groupId,
        title: body.title,
        targetCents: body.targetCents,
        deadline: body.deadline ? new Date(body.deadline) : null,
      })
      .returning();

    if (!pool) {
      throw new Error("Failed to create pool");
    }

    return reply.status(201).send(toPoolResponse(pool));
  });

  app.get("/groups/:groupId/pools", {
    preHandler: [requireGroupMember],
  }, async (request, reply) => {
    const params = groupParamsSchema.parse(request.params);
    const { limit, cursor } = listPoolsQuerySchema.parse(request.query);

    let cursorCondition;
    if (cursor) {
      let parsed: PoolCursor;
      try {
        parsed = decodeCursor(cursor);
      } catch {
        return reply.status(400).send({ error: "bad_request", message: "Invalid cursor" });
      }
      const cursorDate = new Date(parsed.createdAt);
      cursorCondition = or(
        gt(pools.createdAt, cursorDate),
        and(eq(pools.createdAt, cursorDate), gt(pools.id, parsed.id)),
      );
    }

    const groupCondition = eq(pools.groupId, params.groupId);

    const rows = await db
      .select()
      .from(pools)
      .where(cursorCondition ? and(groupCondition, cursorCondition) : groupCondition)
      .orderBy(asc(pools.createdAt), asc(pools.id))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? encodeCursor(data[data.length - 1]!.createdAt, data[data.length - 1]!.id) : null;

    return reply.status(200).send({ data: data.map(toPoolResponse), cursor: nextCursor });
  });

  app.get("/groups/:groupId/pools/:poolId", {
    preHandler: [requireGroupMember],
  }, async (request, reply) => {
    const params = poolParamsSchema.parse(request.params);

    const [pool] = await db
      .select()
      .from(pools)
      .where(and(eq(pools.id, params.poolId), eq(pools.groupId, params.groupId)))
      .limit(1);

    if (!pool) {
      return reply.status(404).send({ error: "not_found", message: "Pool not found" });
    }

    return reply.status(200).send(toPoolResponse(pool));
  });

  app.patch("/groups/:groupId/pools/:poolId", {
    preHandler: [requireGroupMember],
  }, async (request, reply) => {
    const params = poolParamsSchema.parse(request.params);
    const body = closePoolBodySchema.parse(request.body);

    if (request.groupMember?.role !== "owner") {
      return reply.status(403).send({
        error: "forbidden",
        message: "Only the group owner can close or cancel a pool",
      });
    }

    const [existing] = await db
      .select()
      .from(pools)
      .where(and(eq(pools.id, params.poolId), eq(pools.groupId, params.groupId)))
      .limit(1);

    if (!existing) {
      return reply.status(404).send({ error: "not_found", message: "Pool not found" });
    }

    if (existing.status !== "open") {
      return reply.status(409).send({
        error: "conflict",
        message: "Only open pools can be closed or cancelled",
      });
    }

    const [updated] = await db
      .update(pools)
      .set({ status: body.status })
      .where(eq(pools.id, params.poolId))
      .returning();

    if (!updated) {
      throw new Error("Failed to update pool");
    }

    return reply.status(200).send(toPoolResponse(updated));
  });
}
