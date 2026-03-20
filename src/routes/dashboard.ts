import { and, eq, inArray } from "drizzle-orm";
import { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db/index.js";
import { groupMembers, groups } from "../db/schema.js";
import { buildProfileForUser } from "./profile.js";

const dashboardQuerySchema = z.object({
  groupId: z.uuid().optional(),
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

export async function dashboardRoutes(app: FastifyInstance) {
  app.get("/dashboard", async (request, reply) => {
    const userId = request.user!.userId;
    const { groupId } = dashboardQuerySchema.parse(request.query);

    const memberships = await db
      .select({
        groupId: groupMembers.groupId,
      })
      .from(groupMembers)
      .where(
        and(
          eq(groupMembers.externalUserId, userId),
          eq(groupMembers.status, "active"),
        ),
      );

    const activeGroupIds = memberships.map((membership) => membership.groupId);

    const userGroups = activeGroupIds.length > 0
      ? await db
        .select()
        .from(groups)
        .where(inArray(groups.id, activeGroupIds))
      : [];

    const allMembers = activeGroupIds.length > 0
      ? await db
        .select()
        .from(groupMembers)
        .where(inArray(groupMembers.groupId, activeGroupIds))
      : [];

    const membersByGroupId = new Map<string, GroupMemberRecord[]>();
    for (const member of allMembers) {
      const existingMembers = membersByGroupId.get(member.groupId) ?? [];
      existingMembers.push(member);
      membersByGroupId.set(member.groupId, existingMembers);
    }

    const groupsResponse = userGroups.map((group) =>
      toGroupResponse(group, membersByGroupId.get(group.id) ?? []),
    );

    const profile = await buildProfileForUser(db, userId);

    const balance = groupId && activeGroupIds.includes(groupId)
      ? {
        availableCents: 0,
        frozenCents: 0,
        debtCents: 0,
        status: "ok",
      }
      : null;

    return reply.status(200).send({
      groups: groupsResponse,
      balance,
      profile,
      challenges: [],
    });
  });
}
