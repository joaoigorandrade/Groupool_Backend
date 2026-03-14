import { check, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const appMeta = pgTable("app_meta", {
  id: uuid("id").defaultRandom().primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

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
