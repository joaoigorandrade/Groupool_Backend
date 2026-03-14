import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../config/env.js";

const sql = postgres(env.DATABASE_URL, {
  max: 1,
  ssl: "require",
});

export const db = drizzle(sql);
export { sql };
