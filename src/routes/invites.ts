import { randomBytes } from "node:crypto";
import { FastifyInstance } from "fastify";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/index.js";
import { groupMembers, groups, invites, memberBalances, users } from "../db/schema.js";
import { authenticate } from "../middleware/auth.js";
import { requireGroupMember } from "../middleware/requireGroupMember.js";

const INVITE_EXPIRY_DAYS = 7;
const CODE_LENGTH = 6;

function emv(id: string, value: string): string {
  const len = value.length.toString().padStart(2, "0");
  return `${id}${len}${value}`;
}

function crc16(str: string): number {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc;
}

function generatePixPayload(pixKey: string, amountCents: number, merchantName: string): string {
  const merchantAccountInfo = emv("00", "br.gov.bcb.pix") + emv("01", pixKey);
  const additionalData = emv("05", "***");

  const payload =
    emv("00", "01") +
    emv("01", "12") +
    emv("26", merchantAccountInfo) +
    emv("52", "0000") +
    emv("53", "986") +
    emv("54", (amountCents / 100).toFixed(2)) +
    emv("58", "BR") +
    emv("59", merchantName.substring(0, 25)) +
    emv("60", "SAO PAULO") +
    emv("62", additionalData) +
    "6304";

  return payload + crc16(payload).toString(16).toUpperCase().padStart(4, "0");
}

const inviteCodeParamsSchema = z.object({
  inviteCode: z.string().min(1).max(20),
});

const createInviteParamsSchema = z.object({
  groupId: z.uuid(),
});

const createInviteBodySchema = z.object({
  maxUses: z.number().int().min(1).optional(),
});

function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(CODE_LENGTH);
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += chars[bytes[i]! % chars.length];
  }
  return code;
}

export async function inviteRoutes(app: FastifyInstance) {
  app.post(
    "/groups/:groupId/invites",
    { preHandler: [authenticate, requireGroupMember] },
    async (request, reply) => {
      const { groupId } = createInviteParamsSchema.parse(request.params);
      const body = createInviteBodySchema.parse(request.body ?? {});
      const inviterMemberId = request.groupMember!.id;

      let code = generateInviteCode();
      let attempts = 0;
      while (attempts < 5) {
        const [existing] = await db
          .select({ id: invites.id })
          .from(invites)
          .where(eq(invites.code, code))
          .limit(1);

        if (!existing) break;
        code = generateInviteCode();
        attempts++;
      }

      const expiresAt = new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

      const [invite] = await db
        .insert(invites)
        .values({
          code,
          groupId,
          inviterMemberId,
          expiresAt,
          maxUses: body.maxUses ?? null,
        })
        .returning();

      return reply.status(201).send({
        code: invite!.code,
        inviteUrl: `groupool.app/join/${invite!.code}`,
        expiresAt: invite!.expiresAt,
      });
    },
  );

  app.get(
    "/invites/:inviteCode",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { inviteCode } = inviteCodeParamsSchema.parse(request.params);

      const [invite] = await db
        .select()
        .from(invites)
        .where(
          and(
            eq(invites.code, inviteCode),
            eq(invites.status, "active"),
          ),
        )
        .limit(1);

      if (!invite) {
        return reply.status(404).send({
          error: "not_found",
          message: "Invite not found or no longer active",
        });
      }

      if (invite.expiresAt < new Date()) {
        return reply.status(410).send({
          error: "expired",
          message: "This invite link has expired",
        });
      }

      if (invite.maxUses !== null && invite.useCount >= invite.maxUses) {
        return reply.status(410).send({
          error: "exhausted",
          message: "This invite link has reached its maximum number of uses",
        });
      }

      const [group] = await db
        .select()
        .from(groups)
        .where(eq(groups.id, invite.groupId))
        .limit(1);

      if (!group) {
        return reply.status(404).send({
          error: "not_found",
          message: "The group associated with this invite no longer exists",
        });
      }

      const [activeMemberCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(groupMembers)
        .where(
          and(
            eq(groupMembers.groupId, group.id),
            eq(groupMembers.status, "active"),
          ),
        );

      if (activeMemberCount && activeMemberCount.count >= group.maxMembers) {
        return reply.status(410).send({
          error: "group_full",
          message: "This group has reached its maximum number of members",
        });
      }

      const [inviter] = await db
        .select({ displayName: groupMembers.displayName })
        .from(groupMembers)
        .where(eq(groupMembers.id, invite.inviterMemberId))
        .limit(1);

      const [owner] = await db
        .select({ externalUserId: groupMembers.externalUserId })
        .from(groupMembers)
        .where(
          and(
            eq(groupMembers.groupId, group.id),
            eq(groupMembers.role, "owner"),
          ),
        )
        .limit(1);

      const pix =
        group.initialPoolCents > 0 && owner
          ? {
              code: generatePixPayload(owner.externalUserId, group.initialPoolCents, group.name),
              expirationTime: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
            }
          : null;

      return reply.status(200).send({
        groupId: group.id,
        groupName: group.name,
        inviterName: inviter?.displayName ?? "Unknown",
        buyInCents: group.initialPoolCents,
        rules: group.rules,
        pix,
      });
    },
  );

  app.post(
    "/invites/:inviteCode/join",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { inviteCode } = inviteCodeParamsSchema.parse(request.params);
      const userId = request.user!.userId;

      const [invite] = await db
        .select()
        .from(invites)
        .where(
          and(
            eq(invites.code, inviteCode),
            eq(invites.status, "active"),
          ),
        )
        .limit(1);

      if (!invite) {
        return reply.status(404).send({
          error: "not_found",
          message: "Invite not found or no longer active",
        });
      }

      if (invite.expiresAt < new Date()) {
        return reply.status(410).send({
          error: "expired",
          message: "This invite link has expired",
        });
      }

      if (invite.maxUses !== null && invite.useCount >= invite.maxUses) {
        return reply.status(410).send({
          error: "exhausted",
          message: "This invite link has reached its maximum number of uses",
        });
      }

      const [group] = await db
        .select()
        .from(groups)
        .where(eq(groups.id, invite.groupId))
        .limit(1);

      if (!group) {
        return reply.status(404).send({
          error: "not_found",
          message: "The group associated with this invite no longer exists",
        });
      }

      const [existingMember] = await db
        .select()
        .from(groupMembers)
        .where(
          and(
            eq(groupMembers.groupId, group.id),
            eq(groupMembers.externalUserId, userId),
          ),
        )
        .limit(1);

      if (existingMember && existingMember.status === "active") {
        return reply.status(409).send({
          error: "conflict",
          message: "You are already a member of this group",
        });
      }

      const [activeMemberCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(groupMembers)
        .where(
          and(
            eq(groupMembers.groupId, group.id),
            eq(groupMembers.status, "active"),
          ),
        );

      if (activeMemberCount && activeMemberCount.count >= group.maxMembers) {
        return reply.status(410).send({
          error: "group_full",
          message: "This group has reached its maximum number of members",
        });
      }

      const [user] = await db
        .select({ displayName: users.displayName, avatarUrl: users.avatarUrl })
        .from(users)
        .where(eq(users.phone, userId))
        .limit(1);

      const displayName = user?.displayName || request.user!.displayName || userId;

      const result = await db.transaction(async (tx) => {
        let member;

        if (existingMember && existingMember.status !== "active") {
          [member] = await tx
            .update(groupMembers)
            .set({
              status: "active",
              displayName,
              avatarUrl: user?.avatarUrl ?? null,
            })
            .where(eq(groupMembers.id, existingMember.id))
            .returning();
        } else {
          [member] = await tx
            .insert(groupMembers)
            .values({
              groupId: group.id,
              externalUserId: userId,
              displayName,
              avatarUrl: user?.avatarUrl ?? null,
              role: "member",
              status: "active",
            })
            .returning();
        }

        if (!member) {
          throw new Error("Failed to create/update member");
        }

        await tx
          .insert(memberBalances)
          .values({
            groupId: group.id,
            memberId: member.id,
            availableCents: 0,
            status: "ok",
          })
          .onConflictDoNothing({
            target: [memberBalances.groupId, memberBalances.memberId],
          });

        await tx
          .update(invites)
          .set({ useCount: sql`${invites.useCount} + 1` })
          .where(eq(invites.id, invite.id));

        return member;
      });

      const allMembers = await db
        .select()
        .from(groupMembers)
        .where(eq(groupMembers.groupId, group.id));

      return reply.status(200).send({
        id: group.id,
        name: group.name,
        currency: group.currency,
        initialPoolCents: group.initialPoolCents,
        maxMembers: group.maxMembers,
        rules: group.rules,
        createdAt: group.createdAt,
        members: allMembers.map((m) => ({
          id: m.id,
          externalUserId: m.externalUserId,
          displayName: m.displayName,
          role: m.role,
          status: m.status,
          joinedAt: m.joinedAt,
        })),
      });
    },
  );
}
