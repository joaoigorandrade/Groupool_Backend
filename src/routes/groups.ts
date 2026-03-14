import { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/index.js";
import { groupMembers, groups, idempotencyKeys } from "../db/schema.js";

const createGroupBodySchema = z.object({
  name: z.string().trim().min(1).max(80),
  currency: z.literal("BRL"),
  initialPoolCents: z.number().int().min(0),
  creatorExternalId: z.string().trim().min(1).max(120),
  creatorDisplayName: z.string().trim().min(1).max(80),
});

const groupParamsSchema = z.object({
  id: z.uuid(),
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
  app.post("/groups", async (request, reply) => {
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

  app.get("/groups/:id", async (request, reply) => {
    const params = groupParamsSchema.parse(request.params);

    const [group] = await db
      .select()
      .from(groups)
      .where(eq(groups.id, params.id))
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
}
