import assert from "node:assert/strict";
import { and, eq } from "drizzle-orm";
import { buildApp } from "../app.js";
import { db, sql } from "../db/index.js";
import { challenges, groupMembers, groups, memberBalances } from "../db/schema.js";
import { dashboardResponseSchema } from "../routes/dashboard.js";
import { signJwt } from "../services/jwt.js";

async function main() {
  const app = buildApp();
  const suffix = Date.now().toString();
  const phoneNumber = `+5511999${suffix.slice(-7)}`;
  const token = signJwt(phoneNumber, "", 1);
  const headers = {
    authorization: `Bearer ${token}`,
  };
  let groupId: string | null = null;

  try {
    const createGroupResponse = await app.inject({
      method: "POST",
      url: "/v1/groups",
      headers,
      payload: {
        name: `Dashboard Test ${suffix}`,
        currency: "BRL",
        initialPoolCents: 0,
        creatorDisplayName: "Dashboard Tester",
      },
    });

    assert.equal(createGroupResponse.statusCode, 201, createGroupResponse.body);
    const createdGroup = createGroupResponse.json() as { id: string };
    groupId = createdGroup.id;

    const patchProfileResponse = await app.inject({
      method: "PATCH",
      url: "/v1/profile",
      headers,
      payload: {
        displayName: "Dashboard Tester",
        avatarURL: "data:image/png;base64,abc123",
      },
    });

    assert.equal(patchProfileResponse.statusCode, 200, patchProfileResponse.body);

    const [member] = await db
      .select({
        id: groupMembers.id,
      })
      .from(groupMembers)
      .where(
        and(
          eq(groupMembers.groupId, groupId),
          eq(groupMembers.externalUserId, phoneNumber),
          eq(groupMembers.status, "active"),
        ),
      )
      .limit(1);

    assert.ok(member, "Expected active group member to exist");

    await db
      .update(memberBalances)
      .set({
        availableCents: 12_345,
        frozenCents: 500,
        debtCents: 200,
        status: "restricted",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(memberBalances.groupId, groupId),
          eq(memberBalances.memberId, member.id),
        ),
      );

    await db.insert(challenges).values({
      groupId,
      creatorMemberId: member.id,
      challengedMemberId: member.id,
      title: "Verification challenge",
      details: "Used to verify dashboard serialization",
      stakeCents: 700,
      status: "active",
      eventDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
      voteDeadline: new Date(Date.now() + 48 * 60 * 60 * 1000),
    });

    const dashboardResponse = await app.inject({
      method: "GET",
      url: `/v1/dashboard?groupId=${groupId}`,
      headers,
    });

    assert.equal(dashboardResponse.statusCode, 200, dashboardResponse.body);
    const dashboardBody = dashboardResponse.json();
    const parsedDashboard = dashboardResponseSchema.parse(dashboardBody);

    assert.equal(parsedDashboard.balance?.availableCents, 12_345);
    assert.equal(parsedDashboard.balance?.status, "restricted");
    assert.equal(parsedDashboard.profile.avatarURL, "data:image/png;base64,abc123");
    assert.equal(parsedDashboard.profile.reputation, 0);
    assert.equal(parsedDashboard.profile.reliabilityPercent, 100);
    assert.equal(parsedDashboard.challenges.length, 1);
    assert.equal(parsedDashboard.challenges[0]?.eventDeadline.includes("T"), true);

    const balanceResponse = await app.inject({
      method: "GET",
      url: `/v1/groups/${groupId}/balance`,
      headers,
    });

    assert.equal(balanceResponse.statusCode, 200, balanceResponse.body);
    assert.deepEqual(balanceResponse.json(), {
      availableCents: 12_345,
      frozenCents: 500,
      debtCents: 200,
      status: "restricted",
    });

    console.log("Dashboard verification passed.");
  } finally {
    if (groupId) {
      await db.delete(groups).where(eq(groups.id, groupId));
    }
    await app.close();
    await sql.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
