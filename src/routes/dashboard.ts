import { and, eq, inArray } from "drizzle-orm";
import { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db/index.js";
import { challenges, groupMembers, groups, memberBalances } from "../db/schema.js";
import { buildProfileForUser } from "./profile.js";

const dashboardQuerySchema = z.object({
  groupId: z.uuid().optional(),
});

const groupMemberResponseSchema = z.object({
  id: z.uuid(),
  externalUserId: z.string(),
  displayName: z.string(),
  role: z.string(),
  status: z.string().nullable(),
  joinedAt: z.iso.datetime(),
});

const groupResponseSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  currency: z.string(),
  initialPoolCents: z.number().int(),
  createdAt: z.iso.datetime(),
  members: z.array(groupMemberResponseSchema),
});

const balanceResponseSchema = z.object({
  availableCents: z.number().int(),
  frozenCents: z.number().int(),
  debtCents: z.number().int(),
  status: z.enum(["ok", "restricted", "observer"]),
});

const challengeResponseSchema = z.object({
  id: z.uuid(),
  groupId: z.uuid(),
  creatorMemberId: z.uuid(),
  challengedMemberId: z.uuid(),
  title: z.string(),
  details: z.string().nullable(),
  stakeCents: z.number().int(),
  status: z.enum(["pending", "active", "voting", "resolved", "voided", "cancelled"]),
  eventDeadline: z.iso.datetime(),
  voteDeadline: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
});

export const dashboardResponseSchema = z.object({
  groups: z.array(groupResponseSchema),
  balance: balanceResponseSchema.nullable(),
  profile: z.object({
    id: z.string(),
    displayName: z.string(),
    phoneNumber: z.string(),
    avatarURL: z.string().nullable(),
    reputation: z.number().int(),
    reliabilityPercent: z.number().int(),
    observerMode: z.boolean(),
    status: z.string(),
  }),
  challenges: z.array(challengeResponseSchema),
});

type GroupRecord = typeof groups.$inferSelect;
type GroupMemberRecord = typeof groupMembers.$inferSelect;

function toIsoString(value: Date) {
  return value.toISOString();
}

function zeroBalance() {
  return {
    availableCents: 0,
    frozenCents: 0,
    debtCents: 0,
    status: "ok" as const,
  };
}

function toGroupResponse(group: GroupRecord, members: GroupMemberRecord[]) {
  return {
    id: group.id,
    name: group.name,
    currency: group.currency,
    initialPoolCents: group.initialPoolCents,
    createdAt: toIsoString(group.createdAt),
    members: members.map((member) => ({
      id: member.id,
      externalUserId: member.externalUserId,
      displayName: member.displayName,
      role: member.role,
      status: member.status,
      joinedAt: toIsoString(member.joinedAt),
    })),
  };
}

export async function dashboardRoutes(app: FastifyInstance) {
  app.get("/dashboard", async (request, reply) => {
    const userId = request.user!.userId;
    const { groupId } = dashboardQuerySchema.parse(request.query);

    const memberships = await db
      .select({
        id: groupMembers.id,
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
    const activeMembershipByGroupId = new Map(
      memberships.map((membership) => [membership.groupId, membership.id]),
    );

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

    const activeMemberId = groupId ? activeMembershipByGroupId.get(groupId) : undefined;
    const [balanceRow] = groupId && activeMemberId
      ? await db
        .select({
          availableCents: memberBalances.availableCents,
          frozenCents: memberBalances.frozenCents,
          debtCents: memberBalances.debtCents,
          status: memberBalances.status,
        })
        .from(memberBalances)
        .where(
          and(
            eq(memberBalances.groupId, groupId),
            eq(memberBalances.memberId, activeMemberId),
          ),
        )
        .limit(1)
      : [];

    const balance = groupId && activeMemberId
      ? balanceRow ?? zeroBalance()
      : null;

    const challengeRows = activeGroupIds.length > 0
      ? await db
        .select()
        .from(challenges)
        .where(
          and(
            inArray(challenges.groupId, activeGroupIds),
            inArray(challenges.status, ["pending", "active", "voting"]),
          ),
        )
      : [];

    const response = dashboardResponseSchema.parse({
      groups: groupsResponse,
      balance,
      profile,
      challenges: challengeRows.map((challenge) => ({
        id: challenge.id,
        groupId: challenge.groupId,
        creatorMemberId: challenge.creatorMemberId,
        challengedMemberId: challenge.challengedMemberId,
        title: challenge.title,
        details: challenge.details,
        stakeCents: challenge.stakeCents,
        status: challenge.status,
        eventDeadline: toIsoString(challenge.eventDeadline),
        voteDeadline: challenge.voteDeadline ? toIsoString(challenge.voteDeadline) : null,
        createdAt: toIsoString(challenge.createdAt),
      })),
    });

    return reply.status(200).send(response);
  });
}
