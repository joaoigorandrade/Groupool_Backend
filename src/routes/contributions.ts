import { FastifyInstance } from "fastify";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/index.js";
import { contributions, pools } from "../db/schema.js";
import { requireGroupMember } from "../middleware/requireGroupMember.js";

const poolParamsSchema = z.object({
  groupId: z.uuid(),
  poolId: z.uuid(),
});

const createContributionBodySchema = z.object({
  amountCents: z.number().int().min(1),
});

type ContributionRecord = typeof contributions.$inferSelect;

function toContributionResponse(contribution: ContributionRecord) {
  return {
    id: contribution.id,
    poolId: contribution.poolId,
    memberId: contribution.memberId,
    amountCents: contribution.amountCents,
    status: contribution.status,
    pixTransactionId: contribution.pixTransactionId,
    createdAt: contribution.createdAt,
    confirmedAt: contribution.confirmedAt,
  };
}

export async function contributionRoutes(app: FastifyInstance) {
  app.post("/groups/:groupId/pools/:poolId/contributions", {
    preHandler: [requireGroupMember],
  }, async (request, reply) => {
    const params = poolParamsSchema.parse(request.params);
    const body = createContributionBodySchema.parse(request.body);

    const [pool] = await db
      .select()
      .from(pools)
      .where(and(eq(pools.id, params.poolId), eq(pools.groupId, params.groupId)))
      .limit(1);

    if (!pool) {
      return reply.status(404).send({ error: "not_found", message: "Pool not found" });
    }

    if (pool.status !== "open") {
      return reply.status(400).send({
        error: "bad_request",
        message: "Contributions can only be made to open pools",
      });
    }

    const member = request.groupMember!;

    const [contribution] = await db
      .insert(contributions)
      .values({
        poolId: params.poolId,
        memberId: member.id,
        amountCents: body.amountCents,
      })
      .returning();

    if (!contribution) {
      throw new Error("Failed to create contribution");
    }

    return reply.status(201).send(toContributionResponse(contribution));
  });
}
