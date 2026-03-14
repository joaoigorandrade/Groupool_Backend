import Fastify from "fastify";
import { ZodError } from "zod";
import { env } from "./config/env.js";
import { healthRoutes } from "./routes/health.js";

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

  app.register(healthRoutes);

  return app;
}
