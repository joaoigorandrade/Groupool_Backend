import { and, eq } from "drizzle-orm";
import { FastifyReply, FastifyRequest } from "fastify";
import { db } from "../db/index.js";
import { groupMembers } from "../db/schema.js";

type GroupMemberRecord = typeof groupMembers.$inferSelect;

declare module "fastify" {
  interface FastifyRequest {
    groupMember: GroupMemberRecord | null;
  }
}

export async function requireGroupMember(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const user = request.user;
  if (!user) {
    return reply.status(401).send({
      error: "unauthorized",
      message: "Authentication required",
    });
  }

  const params = request.params as { groupId?: string; id?: string };
  const groupId = params.groupId ?? params.id;
  if (!groupId) {
    return reply.status(400).send({
      error: "bad_request",
      message: "Missing groupId route parameter",
    });
  }

  const [member] = await db
    .select()
    .from(groupMembers)
    .where(
      and(
        eq(groupMembers.groupId, groupId),
        eq(groupMembers.externalUserId, user.userId),
        eq(groupMembers.status, "active"),
      ),
    )
    .limit(1);

  if (!member) {
    return reply.status(403).send({
      error: "forbidden",
      message: "You are not an active member of this group",
    });
  }

  request.groupMember = member;
}
