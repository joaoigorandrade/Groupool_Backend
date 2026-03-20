import { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/index.js";
import { groupMembers } from "../db/schema.js";

const patchProfileBodySchema = z.object({
  displayName: z.string().trim().min(1).max(80).optional(),
  avatarURL: z.string().url().optional(),
});

interface ProfileResponse {
  id: string;
  displayName: string;
  phoneNumber: string;
  avatarURL: string | null;
  reputation: number;
  reliabilityPercent: number;
  observerMode: boolean;
  status: string;
}

export async function buildProfileForUser(
  database: typeof db,
  userId: string,
): Promise<ProfileResponse> {
  const memberships = await database
    .select({
      id: groupMembers.id,
      displayName: groupMembers.displayName,
      status: groupMembers.status,
      role: groupMembers.role,
    })
    .from(groupMembers)
    .where(eq(groupMembers.externalUserId, userId));

  const profileSource = memberships.find((member) => member.status === "active")
    ?? memberships[0]
    ?? null;

  if (!profileSource) {
    return {
      id: userId,
      displayName: "",
      phoneNumber: userId,
      avatarURL: null,
      reputation: 0,
      reliabilityPercent: 100,
      observerMode: true,
      status: "invited",
    };
  }

  return {
    id: userId,
    displayName: profileSource.displayName,
    phoneNumber: userId,
    avatarURL: null,
    reputation: 0,
    reliabilityPercent: 100,
    observerMode: profileSource.role !== "owner" && profileSource.status !== "active",
    status: profileSource.status,
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

    if (body.displayName) {
      await db
        .update(groupMembers)
        .set({ displayName: body.displayName })
        .where(eq(groupMembers.externalUserId, userId));
    }

    const profile = await buildProfileForUser(db, userId);
    return reply.status(200).send(profile);
  });

  app.get("/profile/pix-keys", async (request, reply) => {
    const userId = request.user!.userId;
    return reply.status(200).send({ keys: [userId] });
  });
}
