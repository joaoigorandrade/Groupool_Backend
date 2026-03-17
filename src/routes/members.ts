import { FastifyInstance } from "fastify";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/index.js";
import { groupMembers } from "../db/schema.js";
import { authenticate } from "../middleware/auth.js";
import { requireGroupMember } from "../middleware/requireGroupMember.js";

const memberParamsSchema = z.object({
  groupId: z.uuid(),
});

const groupIdParamsSchema = z.object({
  id: z.uuid(),
});

const removeMemberParamsSchema = z.object({
  id: z.uuid(),
  memberId: z.uuid(),
});

const inviteMemberBodySchema = z.object({
  externalUserId: z.string().trim().min(1).max(120),
  displayName: z.string().trim().min(1).max(80),
});

export async function memberRoutes(app: FastifyInstance) {
  app.post(
    "/groups/:groupId/members",
    { preHandler: [authenticate, requireGroupMember] },
    async (request, reply) => {
      const params = memberParamsSchema.parse(request.params);
      const body = inviteMemberBodySchema.parse(request.body);

      const [existing] = await db
        .select()
        .from(groupMembers)
        .where(
          and(
            eq(groupMembers.groupId, params.groupId),
            eq(groupMembers.externalUserId, body.externalUserId),
          ),
        )
        .limit(1);

      if (existing) {
        return reply.status(409).send({
          error: "conflict",
          message: "User is already a member of this group",
        });
      }

      const [member] = await db
        .insert(groupMembers)
        .values({
          groupId: params.groupId,
          externalUserId: body.externalUserId,
          displayName: body.displayName,
          role: "member",
          status: "invited",
        })
        .returning();

      return reply.status(201).send({
        id: member!.id,
        groupId: member!.groupId,
        externalUserId: member!.externalUserId,
        displayName: member!.displayName,
        role: member!.role,
        status: member!.status,
        joinedAt: member!.joinedAt,
      });
    },
  );

  app.post(
    "/groups/:id/members/accept",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { id: groupId } = groupIdParamsSchema.parse(request.params);
      const userId = request.user!.userId;

      const [updated] = await db
        .update(groupMembers)
        .set({ status: "active" })
        .where(
          and(
            eq(groupMembers.groupId, groupId),
            eq(groupMembers.externalUserId, userId),
            eq(groupMembers.status, "invited"),
          ),
        )
        .returning();

      if (!updated) {
        return reply.status(404).send({
          error: "not_found",
          message: "No pending invite found for this user in the group",
        });
      }

      return reply.status(200).send({
        id: updated.id,
        groupId: updated.groupId,
        externalUserId: updated.externalUserId,
        displayName: updated.displayName,
        role: updated.role,
        status: updated.status,
        joinedAt: updated.joinedAt,
      });
    },
  );

  app.delete(
    "/groups/:id/members/:memberId",
    { preHandler: [authenticate, requireGroupMember] },
    async (request, reply) => {
      const { id: groupId, memberId } = removeMemberParamsSchema.parse(request.params);
      const requesterId = request.user!.userId;
      const requesterMember = request.groupMember!;

      const [target] = await db
        .select()
        .from(groupMembers)
        .where(
          and(
            eq(groupMembers.id, memberId),
            eq(groupMembers.groupId, groupId),
            eq(groupMembers.status, "active"),
          ),
        )
        .limit(1);

      if (!target) {
        return reply.status(404).send({
          error: "not_found",
          message: "Member not found in this group",
        });
      }

      const isOwner = requesterMember.role === "owner";
      const isRemovingSelf = target.externalUserId === requesterId;

      if (!isOwner && !isRemovingSelf) {
        return reply.status(403).send({
          error: "forbidden",
          message: "You are not allowed to remove this member",
        });
      }

      if (isOwner && isRemovingSelf) {
        return reply.status(403).send({
          error: "forbidden",
          message: "Owner cannot remove themselves; delete the group instead",
        });
      }

      await db
        .update(groupMembers)
        .set({ status: "removed" })
        .where(eq(groupMembers.id, memberId));

      return reply.status(204).send();
    },
  );
}
