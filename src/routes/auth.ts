import { FastifyInstance } from "fastify";
import { and, eq, gt, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/index.js";
import { otpCodes, otpLocks, otpRequests, users } from "../db/schema.js";
import { env } from "../config/env.js";
import { signJwt } from "../services/jwt.js";
import { sendOtpWhatsapp } from "../services/whatsapp.js";

const MAGIC_CODE = "000000";
const OTP_TTL_MINUTES = 5;
const MAX_REQUESTS_PER_WINDOW = 3;
const REQUEST_WINDOW_MINUTES = 15;
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MINUTES = 30;

const phoneRegex = /^\+55\d{10,11}$/;

const sendOtpBodySchema = z.object({
  phoneNumber: z.string().regex(phoneRegex, "Must be a valid Brazilian phone in E.164 format (+55...)"),
});

const verifyOtpBodySchema = z.object({
  phoneNumber: z.string().regex(phoneRegex, "Must be a valid Brazilian phone in E.164 format (+55...)"),
  code: z.string().length(6, "OTP must be 6 digits"),
});

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function isDevEnvironment(): boolean {
  return env.APP_ENV !== "production";
}

export async function authRoutes(app: FastifyInstance) {
  app.post("/auth/send-otp", {
    config: { rateLimit: isDevEnvironment() ? { max: 1000, timeWindow: "1 minute" } : { max: 10, timeWindow: "1 minute" } },
  }, async (request, reply) => {
    const { phoneNumber } = sendOtpBodySchema.parse(request.body);
    const ip = request.ip;

    if (!isDevEnvironment()) {
      const [lock] = await db
        .select()
        .from(otpLocks)
        .where(eq(otpLocks.phone, phoneNumber))
        .limit(1);

      if (lock && lock.lockedUntil > new Date()) {
        const remainingMs = lock.lockedUntil.getTime() - Date.now();
        const remainingMin = Math.ceil(remainingMs / 60000);
        return reply.status(429).send({
          error: "locked",
          message: `Too many incorrect attempts. This number is locked for ${remainingMin} minutes.`,
        });
      }

      const windowStart = new Date(Date.now() - REQUEST_WINDOW_MINUTES * 60 * 1000);
      const [requestCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(otpRequests)
        .where(
          and(
            eq(otpRequests.phone, phoneNumber),
            gt(otpRequests.createdAt, windowStart),
          ),
        );

      if (requestCount && requestCount.count >= MAX_REQUESTS_PER_WINDOW) {
        return reply.status(429).send({
          error: "rate_limit",
          message: `Too many code requests. Please try again in ${REQUEST_WINDOW_MINUTES} minutes.`,
        });
      }
    }

    await db.insert(otpRequests).values({ phone: phoneNumber, ip });

    const code = generateOtp();
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

    await db.insert(otpCodes).values({
      phone: phoneNumber,
      code,
      expiresAt,
    });

    if (!isDevEnvironment()) {
      const sent = await sendOtpWhatsapp(phoneNumber, code);
      if (!sent) {
        request.log.error({ phone: phoneNumber }, "Failed to send OTP via WhatsApp");
      }
    } else {
      request.log.info(
        { phone: phoneNumber, code, magicCode: MAGIC_CODE },
        "DEV MODE — OTP generated (magic code also accepted)",
      );
    }

    return reply.status(200).send({ success: true });
  });

  app.post("/auth/verify-otp", {
    config: { rateLimit: isDevEnvironment() ? { max: 1000, timeWindow: "1 minute" } : { max: 10, timeWindow: "1 minute" } },
  }, async (request, reply) => {
    const { phoneNumber, code } = verifyOtpBodySchema.parse(request.body);

    let lock: typeof otpLocks.$inferSelect | undefined;

    if (!isDevEnvironment()) {
      const [existingLock] = await db
        .select()
        .from(otpLocks)
        .where(eq(otpLocks.phone, phoneNumber))
        .limit(1);

      lock = existingLock;

      if (lock && lock.lockedUntil > new Date()) {
        const remainingMs = lock.lockedUntil.getTime() - Date.now();
        const remainingMin = Math.ceil(remainingMs / 60000);
        return reply.status(429).send({
          error: "locked",
          message: `Too many incorrect attempts. This number is locked for ${remainingMin} minutes.`,
        });
      }
    }

    let verified = false;

    if (isDevEnvironment() && code === MAGIC_CODE) {
      verified = true;
    } else {
      const [otpRecord] = await db
        .select()
        .from(otpCodes)
        .where(
          and(
            eq(otpCodes.phone, phoneNumber),
            eq(otpCodes.code, code),
            eq(otpCodes.used, false),
            gt(otpCodes.expiresAt, new Date()),
          ),
        )
        .limit(1);

      if (otpRecord) {
        await db
          .update(otpCodes)
          .set({ used: true })
          .where(eq(otpCodes.id, otpRecord.id));

        verified = true;
      }
    }

    if (!verified) {
      if (!isDevEnvironment()) {
        const currentFailCount = lock?.failCount ?? 0;
        const newFailCount = currentFailCount + 1;

        if (newFailCount >= MAX_FAILED_ATTEMPTS) {
          const lockedUntil = new Date(Date.now() + LOCK_DURATION_MINUTES * 60 * 1000);
          await db
            .insert(otpLocks)
            .values({ phone: phoneNumber, lockedUntil, failCount: newFailCount })
            .onConflictDoUpdate({
              target: otpLocks.phone,
              set: { lockedUntil, failCount: newFailCount },
            });

          return reply.status(429).send({
            error: "locked",
            message: `Too many incorrect attempts. This number is locked for ${LOCK_DURATION_MINUTES} minutes.`,
          });
        }

        await db
          .insert(otpLocks)
          .values({
            phone: phoneNumber,
            lockedUntil: new Date(0),
            failCount: newFailCount,
          })
          .onConflictDoUpdate({
            target: otpLocks.phone,
            set: { failCount: newFailCount },
          });
      }

      return reply.status(401).send({
        error: "invalid_code",
        message: "Invalid or expired verification code.",
      });
    }

    await db
      .delete(otpLocks)
      .where(eq(otpLocks.phone, phoneNumber));

    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.phone, phoneNumber))
      .limit(1);

    let tokenGeneration: number;
    let displayName: string;

    if (existingUser) {
      tokenGeneration = existingUser.tokenGeneration + 1;
      displayName = existingUser.displayName;
      await db
        .update(users)
        .set({ tokenGeneration, updatedAt: new Date() })
        .where(eq(users.phone, phoneNumber));
    } else {
      tokenGeneration = 1;
      displayName = "";
      await db
        .insert(users)
        .values({ phone: phoneNumber, tokenGeneration });
    }

    const token = signJwt(phoneNumber, displayName, tokenGeneration);

    return reply.status(200).send({ token });
  });
}
