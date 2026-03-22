import { FastifyInstance } from "fastify";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/index.js";
import { groupMembers, users } from "../db/schema.js";
import { signJwt } from "../services/jwt.js";

const patchProfileBodySchema = z.object({
  displayName: z.string().trim().min(2).max(30).optional(),
  avatarURL: z.string().trim().min(1).optional(),
});

interface ProfileResponse {
  id: string;
  displayName: string;
  phoneNumber: string;
  avatarURL: string | null;
  reputation: number;
  reliabilityPercent: number;
  profileSetupComplete: boolean;
  token?: string;
}

export async function buildProfileForUser(
  database: typeof db,
  userId: string,
): Promise<ProfileResponse> {
  const [user] = await database
    .select()
    .from(users)
    .where(eq(users.phone, userId))
    .limit(1);

  if (!user) {
    return {
      id: userId,
      displayName: "",
      phoneNumber: userId,
      avatarURL: null,
      reputation: 0,
      reliabilityPercent: 100,
      profileSetupComplete: false,
    };
  }

  const [reputationAgg] = await database
    .select({
      avgReputation: sql<number>`coalesce(avg(${groupMembers.reputation}), 0)::int`,
      avgReliability: sql<number>`coalesce(avg(${groupMembers.reliabilityPercent}), 100)::int`,
    })
    .from(groupMembers)
    .where(eq(groupMembers.externalUserId, userId));

  return {
    id: user.id,
    displayName: user.displayName,
    phoneNumber: user.phone,
    avatarURL: user.avatarUrl,
    reputation: reputationAgg?.avgReputation ?? 0,
    reliabilityPercent: reputationAgg?.avgReliability ?? 100,
    profileSetupComplete: user.profileSetupComplete,
  };
}

export async function profileRoutes(app: FastifyInstance) {
  app.get("/profile", async (request, reply) => {
    const userId = request.user!.userId;
    const profile = await buildProfileForUser(db, userId);
    return reply.status(200).send(profile);
  });

  app.patch("/profile", async (request, reply) => {
    const userId = request.user!.userId;
    const body = patchProfileBodySchema.parse(request.body);

    if (!body.displayName && !body.avatarURL) {
      const profile = await buildProfileForUser(db, userId);
      return reply.status(200).send(profile);
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (body.displayName) updates.displayName = body.displayName;
    if (body.avatarURL) updates.avatarUrl = body.avatarURL;
    updates.profileSetupComplete = true;

    await db
      .update(users)
      .set(updates)
      .where(eq(users.phone, userId));

    if (body.displayName || body.avatarURL) {
      const memberUpdates: Record<string, unknown> = {};
      if (body.displayName) memberUpdates.displayName = body.displayName;
      if (body.avatarURL) memberUpdates.avatarUrl = body.avatarURL;
      await db
        .update(groupMembers)
        .set(memberUpdates)
        .where(eq(groupMembers.externalUserId, userId));
    }

    const [updatedUser] = await db
      .select()
      .from(users)
      .where(eq(users.phone, userId))
      .limit(1);

    const profile = await buildProfileForUser(db, userId);

    if (updatedUser) {
      const token = signJwt(userId, updatedUser.displayName, updatedUser.tokenGeneration);
      return reply.status(200).send({ ...profile, token });
    }

    return reply.status(200).send(profile);
  });

  app.get("/profile/pix-keys", async (request, reply) => {
    const userId = request.user!.userId;
    return reply.status(200).send({ keys: [userId] });
  });
}
