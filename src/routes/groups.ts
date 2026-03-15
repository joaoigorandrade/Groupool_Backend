import { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
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
