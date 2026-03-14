import { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/index.js";
import { groups } from "../db/schema.js";

const createGroupBodySchema = z.object({
  name: z.string().trim().min(1).max(80),
  currency: z.literal("BRL"),
  initialPoolCents: z.number().int().min(0),
});

const groupParamsSchema = z.object({
  id: z.string().uuid(),
});

export async function groupRoutes(app: FastifyInstance) {
  app.post("/groups", async (request, reply) => {
    const body = createGroupBodySchema.parse(request.body);

    const [group] = await db
      .insert(groups)
      .values({
        name: body.name,
        currency: body.currency,
        initialPoolCents: body.initialPoolCents,
      })
      .returning();

    return reply.status(201).send(group);
  });

  app.get("/groups/:id", async (request, reply) => {
    const params = groupParamsSchema.parse(request.params);

    const [group] = await db
      .select()
      .from(groups)
      .where(eq(groups.id, params.id))
      .limit(1);

    if (!group) {
      return reply.status(404).send({
        error: "not_found",
        message: "Group not found",
      });
    }

    return group;
  });
}
