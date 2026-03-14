import { FastifyInstance } from "fastify";
import { env } from "../config/env.js";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/health", async () => {
    return {
      status: "ok",
      environment: env.APP_ENV,
      version: env.APP_VERSION,
      database: "unknown",
      timestamp: new Date().toISOString(),
    };
  });
}
