import { FastifyInstance } from "fastify";
import { env } from "../config/env.js";

export async function homeRoutes(app: FastifyInstance) {
  app.get("/", async () => {
    return {
      name: "Groupool API",
      status: "online",
      version: env.APP_VERSION,
      environment: env.APP_ENV,
    };
  });
}
