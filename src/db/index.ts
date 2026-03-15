import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../config/env.js";

const sql = postgres(env.DATABASE_URL, {
  max: env.DB_POOL_MAX,
  ssl: "require",
});

export const db = drizzle(sql);
export { sql };
