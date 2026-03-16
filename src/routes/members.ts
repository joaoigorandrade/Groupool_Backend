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
}
