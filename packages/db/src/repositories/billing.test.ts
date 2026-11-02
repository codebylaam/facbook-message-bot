import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { inArray } from "drizzle-orm";
import { createDb } from "../client.ts";
import { users } from "../schema/auth.ts";
import {
  assignPlanToOwner,
  expireSubscription,
  findActiveSubscriptionWithPlan,
  findPlanByName,
  findSubscriptionForOwner,
  listPlans,
  listUsersWithPlan,
  setUserRole,
  upsertPlan,
} from "./billing.ts";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is required to run the billing tests");
}

const { db, close } = createDb(url, { max: 2 });

const runId = crypto.randomUUID().slice(0, 8);
const suffix = `-${runId}`;
const owner = { id: `bill-${runId}`, name: "Billing", email: `bl-${runId}@test.local` };

let planId = "";
let planName = "";

beforeAll(async () => {
  planName = `Test Plan ${suffix}`;

  const plan = await upsertPlan(db, {
    name: planName,
    aiRepliesPerMonth: 42,
    pageLimit: 2,
    price: "999",
  });

  if (!plan) {
    throw new Error("failed to insert the plan");
  }

  planId = plan.id;

  await db.insert(users).values([owner]);
});

afterAll(async () => {
  await db.delete(users).where(inArray(users.id, [owner.id]));
  await close();
});

describe("plans", () => {
  test("upsert is idempotent by name", async () => {
    const again = await upsertPlan(db, {
      name: planName,
      aiRepliesPerMonth: 84,
      pageLimit: 4,
      price: "1999",
    });

    expect(again?.id).toBe(planId);
    expect(again?.aiRepliesPerMonth).toBe(84);

    const found = await findPlanByName(db, planName);
    expect(found?.pageLimit).toBe(4);
  });

  test("lists plans cheapest first", async () => {
    const plans = await listPlans(db);

    expect(plans.length).toBeGreaterThan(0);
    expect(plans[0]?.aiRepliesPerMonth).toBeLessThanOrEqual(
      plans[plans.length - 1]?.aiRepliesPerMonth ?? 0,
    );
  });
});

describe("subscriptions", () => {
  test("assigns a plan to an owner", async () => {
    const start = new Date();
    const end = new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000);

    await assignPlanToOwner(db, { ownerId: owner.id, planId, periodStart: start, periodEnd: end });

    const subscription = await findSubscriptionForOwner(db, owner.id);

    expect(subscription?.planName).toBe(planName);
    expect(subscription?.aiRepliesPerMonth).toBe(84);
    expect(subscription?.status).toBe("active");
  });

  test("appears as the active plan while the period is open", async () => {
    const active = await findActiveSubscriptionWithPlan(db, owner.id);

    expect(active?.planName).toBe(planName);
  });

  test("assigning again replaces the current period instead of adding one", async () => {
    const start = new Date();
    const end = new Date(start.getTime() + 60 * 24 * 60 * 60 * 1000);

    await assignPlanToOwner(db, { ownerId: owner.id, planId, periodStart: start, periodEnd: end });

    const subscription = await findSubscriptionForOwner(db, owner.id);
    const rows = await db.query.subscriptions.findMany({
      where: (table, { eq: equals }) => equals(table.ownerId, owner.id),
    });

    expect(rows).toHaveLength(1);
    expect(subscription?.periodEnd.getTime()).toBeGreaterThan(Date.now());
  });

  test("stops counting as active once expired", async () => {
    const start = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    const end = new Date(Date.now() - 24 * 60 * 60 * 1000);

    await assignPlanToOwner(db, { ownerId: owner.id, planId, periodStart: start, periodEnd: end });

    expect(await findActiveSubscriptionWithPlan(db, owner.id)).toBeNull();
  });

  test("an expired subscription is still readable for the billing page", async () => {
    const subscription = await findSubscriptionForOwner(db, owner.id);

    expect(subscription?.planName).toBe(planName);
  });

  test("expire marks the subscription expired", async () => {
    await expireSubscription(db, owner.id);

    expect((await findSubscriptionForOwner(db, owner.id))?.status).toBe("expired");
  });
});

describe("admin listing", () => {
  test("shows a user with their plan", async () => {
    const start = new Date();
    const end = new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000);
    await assignPlanToOwner(db, { ownerId: owner.id, planId, periodStart: start, periodEnd: end });

    const rows = await listUsersWithPlan(db, { limit: 200 });
    const row = rows.find((entry) => entry.id === owner.id);

    expect(row?.planName).toBe(planName);
    expect(row?.aiRepliesPerMonth).toBe(84);
    expect(row?.role).toBe("seller");
  });

  test("promotes and demotes a user", async () => {
    const promoted = await setUserRole(db, owner.id, "admin");
    expect(promoted?.role).toBe("admin");

    const demoted = await setUserRole(db, owner.id, "seller");
    expect(demoted?.role).toBe("seller");
  });
});
