import { FastifyInstance } from "fastify";
import { env } from "../config/env.js";
import { sql } from "../db/index.js";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/health", async (request) => {
    let database: "connected" | "disconnected" = "connected";

    try {
      await sql`select 1`;
    } catch (error) {
      database = "disconnected";

      request.log.error(
        {
          err: error,
          requestId: request.id,
        },
        "Database connectivity check failed",
      );
    }

    return {
      status: "ok",
      environment: env.APP_ENV,
      version: env.APP_VERSION,
      database,
      timestamp: new Date().toISOString(),
    };
  });
}
