import { buildApp } from "./app.js";
import { env } from "./config/env.js";
import { sql } from "./db/index.js";

const app = buildApp();

const shutdown = async (signal: string) => {
  app.log.info({ signal }, "Shutdown signal received");
  try {
    await app.close();
    app.log.info("Fastify server closed");
    await sql.end();
    app.log.info("Postgres connection closed");
    process.exit(0);
  } catch (error) {
    app.log.error({ err: error }, "Error during shutdown");
    process.exit(1);
  }
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

const start = async () => {
  try {
    await app.listen({
      port: env.PORT,
      host: "0.0.0.0",
    });

    app.log.info({
      message: "Server started",
      port: env.PORT,
      environment: env.APP_ENV,
      version: env.APP_VERSION,
    });
  } catch (error) {
    app.log.error({ err: error }, "Failed to start server");
    process.exit(1);
  }
};

start();
