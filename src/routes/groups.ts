import { FastifyInstance } from "fastify";
import { and, asc, eq, gt, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/index.js";
import { groupMembers, groups, idempotencyKeys } from "../db/schema.js";
import { authenticate } from "../middleware/auth.js";
import { requireGroupMember } from "../middleware/requireGroupMember.js";

const createGroupBodySchema = z.object({
  name: z.string().trim().min(1).max(80),
  currency: z.literal("BRL"),
  initialPoolCents: z.number().int().min(0),
  creatorExternalId: z.string().trim().min(1).max(120),
  creatorDisplayName: z.string().trim().min(1).max(80),
});

const groupParamsSchema = z.object({
  groupId: z.uuid(),
});

const updateGroupBodySchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
});

const listGroupsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().optional(),
});

interface GroupCursor {
  createdAt: string;
  id: string;
}

function encodeCursor(createdAt: Date, id: string): string {
  return Buffer.from(JSON.stringify({ createdAt: createdAt.toISOString(), id })).toString("base64url");
}

function decodeCursor(cursor: string): GroupCursor {
  try {
    return JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as GroupCursor;
  } catch {
    throw new Error("Invalid cursor");
  }
}

type GroupRecord = typeof groups.$inferSelect;
type GroupMemberRecord = typeof groupMembers.$inferSelect;

function toGroupResponse(group: GroupRecord, members: GroupMemberRecord[]) {
  return {
    id: group.id,
    name: group.name,
    currency: group.currency,
    initialPoolCents: group.initialPoolCents,
    createdAt: group.createdAt,
    members: members.map((member) => ({
      id: member.id,
      externalUserId: member.externalUserId,
      displayName: member.displayName,
      role: member.role,
      status: member.status,
      joinedAt: member.joinedAt,
    })),
  };
}

export async function groupRoutes(app: FastifyInstance) {
  app.get("/groups", { preHandler: [authenticate] }, async (request, reply) => {
    const { limit, cursor } = listGroupsQuerySchema.parse(request.query);
    const userId = request.user!.userId;

    let cursorCondition;
    if (cursor) {
      let parsed: GroupCursor;
      try {
        parsed = decodeCursor(cursor);
      } catch {
        return reply.status(400).send({ error: "bad_request", message: "Invalid cursor" });
      }
      const cursorDate = new Date(parsed.createdAt);
      cursorCondition = or(
        gt(groups.createdAt, cursorDate),
        and(eq(groups.createdAt, cursorDate), gt(groups.id, parsed.id)),
      );
    }

    const membershipCondition = and(
      eq(groupMembers.externalUserId, userId),
      eq(groupMembers.status, "active"),
    );

    const rows = await db
      .select({
        id: groups.id,
        name: groups.name,
        currency: groups.currency,
        initialPoolCents: groups.initialPoolCents,
        createdAt: groups.createdAt,
      })
      .from(groups)
      .innerJoin(groupMembers, eq(groupMembers.groupId, groups.id))
      .where(cursorCondition ? and(membershipCondition, cursorCondition) : membershipCondition)
      .orderBy(asc(groups.createdAt), asc(groups.id))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? encodeCursor(data[data.length - 1]!.createdAt, data[data.length - 1]!.id) : null;

    return reply.status(200).send({ data, cursor: nextCursor });
  });

  app.post("/groups", { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } }, async (request, reply) => {
    const body = createGroupBodySchema.parse(request.body);
    const idempotencyKey = request.headers["idempotency-key"];

    if (typeof idempotencyKey === "string" && idempotencyKey.length > 0) {
      const [existingKey] = await db
        .select()
        .from(idempotencyKeys)
        .where(eq(idempotencyKeys.key, idempotencyKey))
        .limit(1);

      if (existingKey) {
        const [existingGroup] = await db
          .select()
          .from(groups)
          .where(eq(groups.id, existingKey.resourceId))
          .limit(1);

        if (existingGroup) {
          const members = await db
            .select()
            .from(groupMembers)
            .where(eq(groupMembers.groupId, existingGroup.id));

          return reply.status(200).send(toGroupResponse(existingGroup, members));
        }
      }
    }

    const result = await db.transaction(async (tx) => {
      const [group] = await tx
        .insert(groups)
        .values({
          name: body.name.trim(),
          currency: body.currency,
          initialPoolCents: body.initialPoolCents,
        })
        .returning();

      if (!group) {
        throw new Error("Failed to create group");
      }

      const [creatorMember] = await tx
        .insert(groupMembers)
        .values({
          groupId: group.id,
          externalUserId: body.creatorExternalId.trim(),
          displayName: body.creatorDisplayName.trim(),
          role: "owner",
          status: "active",
        })
        .returning();

      if (!creatorMember) {
        throw new Error("Failed to create creator member");
      }

      if (typeof idempotencyKey === "string" && idempotencyKey.length > 0) {
        await tx.insert(idempotencyKeys).values({
          key: idempotencyKey,
          resourceType: "group",
          resourceId: group.id,
        });
      }

      return {
        group,
        members: [creatorMember],
      };
    });

    return reply.status(201).send(toGroupResponse(result.group, result.members));
  });

  app.get("/groups/:groupId", {
    preHandler: [authenticate, requireGroupMember],
  }, async (request, reply) => {
    const params = groupParamsSchema.parse(request.params);

    const [group] = await db
      .select()
      .from(groups)
      .where(eq(groups.id, params.groupId))
      .limit(1);

    if (!group) {
      return reply.status(404).send({
        error: "not_found",
        message: "Group not found",
      });
    }

    const members = await db
      .select()
      .from(groupMembers)
      .where(eq(groupMembers.groupId, group.id));

    return toGroupResponse(group, members);
  });

  app.delete("/groups/:groupId", {
    preHandler: [authenticate, requireGroupMember],
  }, async (request, reply) => {
    const params = groupParamsSchema.parse(request.params);

    if (request.groupMember?.role !== "owner") {
      return reply.status(403).send({
        error: "forbidden",
        message: "Only the group owner can delete the group",
      });
    }

    const deleted = await db
      .delete(groups)
      .where(eq(groups.id, params.groupId))
      .returning({ id: groups.id });

    if (deleted.length === 0) {
      return reply.status(404).send({ error: "not_found", message: "Group not found" });
    }

    return reply.status(204).send();
  });

  app.patch("/groups/:groupId", {
    preHandler: [authenticate, requireGroupMember],
  }, async (request, reply) => {
    const params = groupParamsSchema.parse(request.params);
    const body = updateGroupBodySchema.parse(request.body);

    if (request.groupMember?.role !== "owner") {
      return reply.status(403).send({
        error: "forbidden",
        message: "Only the group owner can update the group",
      });
    }

    if (!body.name) {
      // Nothing to update — return current group
      const [group] = await db
        .select()
        .from(groups)
        .where(eq(groups.id, params.groupId))
        .limit(1);

      if (!group) {
        return reply.status(404).send({ error: "not_found", message: "Group not found" });
      }

      const members = await db
        .select()
        .from(groupMembers)
        .where(eq(groupMembers.groupId, group.id));

      return reply.status(200).send(toGroupResponse(group, members));
    }

    const [updated] = await db
      .update(groups)
      .set({ name: body.name })
      .where(eq(groups.id, params.groupId))
      .returning();

    if (!updated) {
      return reply.status(404).send({ error: "not_found", message: "Group not found" });
    }

    const members = await db
      .select()
      .from(groupMembers)
      .where(eq(groupMembers.groupId, updated.id));

    return reply.status(200).send(toGroupResponse(updated, members));
  });
}
