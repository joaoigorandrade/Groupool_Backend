import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const appMeta = pgTable("app_meta", {
  id: uuid("id").defaultRandom().primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
