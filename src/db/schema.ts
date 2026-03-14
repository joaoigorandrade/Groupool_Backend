import {
  check,
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
