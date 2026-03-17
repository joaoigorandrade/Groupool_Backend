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
    role: text("role").notNull(),
    status: text("status").notNull(),
    joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("group_members_group_user_unique").on(table.groupId, table.externalUserId),
    check("group_members_role_check", sql`${table.role} in ('owner', 'member')`),
    check("group_members_status_check", sql`${table.status} in ('active', 'invited', 'removed')`),
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
