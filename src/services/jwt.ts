import { createHmac } from "node:crypto";
import { env } from "../config/env.js";

interface JwtPayload {
  sub: string;
  exp: number;
  iat: number;
  user_metadata: {
    display_name: string;
  };
}

export function signJwt(userId: string, displayName: string): string {
  const now = Math.floor(Date.now() / 1000);
  const expiresIn = 60 * 60 * 24 * 30; // 30 days

  const header = { alg: "HS256", typ: "JWT" };

  const payload: JwtPayload = {
    sub: userId,
    iat: now,
    exp: now + expiresIn,
    user_metadata: {
      display_name: displayName,
    },
  };

  const headerB64 = Buffer.from(JSON.stringify(header)).toString("base64url");
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signingInput = `${headerB64}.${payloadB64}`;

  const signature = createHmac("sha256", env.JWT_SECRET)
    .update(signingInput)
    .digest("base64url");

  return `${headerB64}.${payloadB64}.${signature}`;
}
