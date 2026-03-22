import { createHmac, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { FastifyReply, FastifyRequest } from "fastify";
import { env } from "../config/env.js";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";

export interface AuthUser {
  userId: string;
  displayName: string;
}

declare module "fastify" {
  interface FastifyRequest {
    user: AuthUser | null;
  }
}

interface JwtPayload {
  sub: string;
  exp?: number;
  gen?: number;
  user_metadata?: {
    display_name?: string;
    name?: string;
    full_name?: string;
  };
}

function verifyJwt(token: string): JwtPayload {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Malformed token");

  const headerB64 = parts[0]!;
  const payloadB64 = parts[1]!;
  const signatureB64 = parts[2]!;
  const signingInput = `${headerB64}.${payloadB64}`;

  const expectedSig = createHmac("sha256", env.JWT_SECRET)
    .update(signingInput)
    .digest("base64url");

  const expected = Buffer.from(expectedSig);
  const actual = Buffer.from(signatureB64);

  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    throw new Error("Invalid signature");
  }

  const payload: JwtPayload = JSON.parse(
    Buffer.from(payloadB64, "base64url").toString("utf8"),
  );

  if (payload.exp !== undefined && payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error("Token expired");
  }

  if (!payload.sub) throw new Error("Missing subject claim");

  return payload;
}

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const authHeader = request.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return reply.status(401).send({
      error: "unauthorized",
      message: "Missing or invalid Authorization header",
    });
  }

  const token = authHeader.slice(7);

  try {
    const payload = verifyJwt(token);
    const meta = payload.user_metadata ?? {};

    if (payload.gen !== undefined) {
      const [user] = await db
        .select({ tokenGeneration: users.tokenGeneration })
        .from(users)
        .where(eq(users.phone, payload.sub))
        .limit(1);

      if (user && payload.gen < user.tokenGeneration) {
        return reply.status(401).send({
          error: "session_expired",
          message: "Session expired — you logged in on another device.",
        });
      }
    }

    request.user = {
      userId: payload.sub,
      displayName: meta.display_name ?? meta.name ?? meta.full_name ?? "",
    };
  } catch {
    return reply.status(401).send({
      error: "unauthorized",
      message: "Invalid or expired token",
    });
  }
}
