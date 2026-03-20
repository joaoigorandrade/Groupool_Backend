import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const groups = pgTable(
  "groups",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    currency: text("currency").notNull(),
    initialPoolCents: integer("initial_pool_cents").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check("groups_name_length_check", sql`char_length(${table.name}) between 1 and 80`),
    check("groups_currency_check", sql`${table.currency} = 'BRL'`),
    check("groups_initial_pool_cents_check", sql`${table.initialPoolCents} >= 0`),
  ],
);

export const idempotencyKeys = pgTable("idempotency_keys", {
  id: uuid("id").defaultRandom().primaryKey(),
  key: text("key").notNull().unique(),
  resourceType: text("resource_type").notNull(),
  resourceId: uuid("resource_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const groupMembers = pgTable(
  "group_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    externalUserId: text("external_user_id").notNull(),
    displayName: text("display_name").notNull(),
    avatarUrl: text("avatar_url"),
    reputation: integer("reputation").notNull().default(0),
    reliabilityPercent: integer("reliability_percent").notNull().default(100),
    role: text("role").notNull(),
    status: text("status").notNull(),
    joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("group_members_group_user_unique").on(table.groupId, table.externalUserId),
    check("group_members_reputation_check", sql`${table.reputation} >= 0`),
    check(
      "group_members_reliability_percent_check",
      sql`${table.reliabilityPercent} between 0 and 100`,
    ),
    check("group_members_role_check", sql`${table.role} in ('owner', 'member')`),
    check("group_members_status_check", sql`${table.status} in ('active', 'invited', 'removed')`),
  ],
);

export const memberBalances = pgTable(
  "member_balances",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => groupMembers.id, { onDelete: "cascade" }),
    availableCents: integer("available_cents").notNull().default(0),
    frozenCents: integer("frozen_cents").notNull().default(0),
    debtCents: integer("debt_cents").notNull().default(0),
    status: text("status").notNull().default("ok"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("member_balances_group_member_unique").on(table.groupId, table.memberId),
    check("member_balances_available_cents_check", sql`${table.availableCents} >= 0`),
    check("member_balances_frozen_cents_check", sql`${table.frozenCents} >= 0`),
    check("member_balances_debt_cents_check", sql`${table.debtCents} >= 0`),
    check("member_balances_status_check", sql`${table.status} in ('ok', 'restricted', 'observer')`),
  ],
);

export const otpCodes = pgTable(
  "otp_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    phone: text("phone").notNull(),
    code: text("code").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    used: boolean("used").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("otp_codes_phone_idx").on(table.phone),
  ],
);

export const otpRequests = pgTable(
  "otp_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    phone: text("phone").notNull(),
    ip: text("ip").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("otp_requests_phone_created_at_idx").on(table.phone, table.createdAt),
    index("otp_requests_ip_created_at_idx").on(table.ip, table.createdAt),
  ],
);

export const otpLocks = pgTable("otp_locks", {
  phone: text("phone").primaryKey(),
  lockedUntil: timestamp("locked_until", { withTimezone: true }).notNull(),
  failCount: integer("fail_count").notNull().default(0),
});

export const pools = pgTable(
  "pools",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    targetCents: integer("target_cents").notNull(),
    collectedCents: integer("collected_cents").notNull().default(0),
    status: text("status").notNull().default("open"),
    deadline: timestamp("deadline", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check("pools_target_cents_check", sql`${table.targetCents} > 0`),
    check("pools_collected_cents_check", sql`${table.collectedCents} >= 0`),
    check("pools_status_check", sql`${table.status} in ('open', 'closed', 'cancelled')`),
    index("pools_group_id_idx").on(table.groupId),
  ],
);

export const contributions = pgTable(
  "contributions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    poolId: uuid("pool_id")
      .notNull()
      .references(() => pools.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => groupMembers.id, { onDelete: "cascade" }),
    amountCents: integer("amount_cents").notNull(),
    status: text("status").notNull().default("pending"),
    pixTransactionId: text("pix_transaction_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  },
  (table) => [
    check("contributions_amount_cents_check", sql`${table.amountCents} > 0`),
    check("contributions_status_check", sql`${table.status} in ('pending', 'confirmed', 'failed')`),
    index("contributions_pool_id_idx").on(table.poolId),
    index("contributions_member_id_idx").on(table.memberId),
  ],
);

export const challenges = pgTable(
  "challenges",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    creatorMemberId: uuid("creator_member_id")
      .notNull()
      .references(() => groupMembers.id, { onDelete: "cascade" }),
    challengedMemberId: uuid("challenged_member_id")
      .notNull()
      .references(() => groupMembers.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    details: text("details"),
    stakeCents: integer("stake_cents").notNull(),
    status: text("status").notNull(),
    eventDeadline: timestamp("event_deadline", { withTimezone: true }).notNull(),
    voteDeadline: timestamp("vote_deadline", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check("challenges_title_length_check", sql`char_length(${table.title}) between 1 and 160`),
    check("challenges_stake_cents_check", sql`${table.stakeCents} >= 0`),
    check(
      "challenges_status_check",
      sql`${table.status} in ('pending', 'active', 'voting', 'resolved', 'voided', 'cancelled')`,
    ),
    index("challenges_group_id_idx").on(table.groupId),
    index("challenges_status_idx").on(table.status),
  ],
);
