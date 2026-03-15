import cors from "@fastify/cors";
import Fastify from "fastify";
import { ZodError } from "zod";
import { env } from "./config/env.js";
import { groupRoutes } from "./routes/groups.js";
import { healthRoutes } from "./routes/health.js";
import { homeRoutes } from "./routes/home.js";

export function buildApp() {
  const app = Fastify({
    logger: env.NODE_ENV !== "test",
    genReqId: () => crypto.randomUUID(),
  });

  app.setErrorHandler((error, request, reply) => {
    request.log.error(
      {
        err: error,
        requestId: request.id,
        method: request.method,
        url: request.url,
      },
      "Request failed",
    );

    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: "validation_error",
        message: "Invalid request data",
      });
    }

    return reply.status(500).send({
      error: "internal_error",
      message: "Something went wrong",
    });
  });

  app.setNotFoundHandler((request, reply) => {
    request.log.warn(
      {
        requestId: request.id,
        method: request.method,
        url: request.url,
      },
      "Route not found",
    );

    return reply.status(404).send({
      error: "not_found",
      message: "Route not found",
    });
  });

  app.register(cors, {
    origin:
      env.NODE_ENV === "development"
        ? [env.CORS_ORIGIN, "http://localhost:3000", "http://localhost:8080"]
        : env.CORS_ORIGIN,
  });

  app.register(homeRoutes);
  app.register(healthRoutes);
  app.register(groupRoutes, { prefix: "/v1" });

  return app;
}
