import {
  assignPlanToOwner,
  countAiReplies,
  findPlanByName,
  findSubscriptionForOwner,
  findUserById,
  listPlans,
  listUsersWithPlan,
  periodStartFor,
  setUserRole,
} from "@fb-bot/db";
import { assignPlanSchema, setRoleSchema } from "@fb-bot/shared";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { db } from "../db.ts";
import { type AppEnv, requireAdmin } from "../middleware/auth.ts";

export const adminRoute = new Hono<AppEnv>();

adminRoute.use("*", requireAdmin);

function addMonths(from: Date, months: number): Date {
  const to = new Date(from);
  to.setMonth(to.getMonth() + months);

  return to;
}

adminRoute.get("/users", async (c) => {
  const limit = Math.min(Number(c.req.query("limit") ?? 50) || 50, 200);
  const offset = Math.max(Number(c.req.query("offset") ?? 0) || 0, 0);
  const users = await listUsersWithPlan(db, { limit, offset });

  const rows = await Promise.all(
    users.map(async (user) => {
      const used = await countAiReplies(db, user.id, periodStartFor());

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt.toISOString(),
        planName: user.planName ?? null,
        aiRepliesPerMonth: user.aiRepliesPerMonth ?? null,
        subscriptionStatus: user.subscriptionStatus ?? null,
        periodEnd: user.periodEnd?.toISOString() ?? null,
        used,
      };
    }),
  );

  return c.json({ users: rows });
});

adminRoute.get("/plans", async (c) => {
  const plans = await listPlans(db);

  return c.json({ plans });
});

adminRoute.post("/users/:id/subscription", zValidator("json", assignPlanSchema), async (c) => {
  const user = await findUserById(db, c.req.param("id"));

  if (!user) {
    throw new HTTPException(404, { message: "User not found" });
  }

  const { planName, months } = c.req.valid("json");
  const plan = await findPlanByName(db, planName);

  if (!plan) {
    throw new HTTPException(404, { message: `No plan called ${planName}` });
  }

  const start = new Date();
  const subscription = await assignPlanToOwner(db, {
    ownerId: user.id,
    planId: plan.id,
    periodStart: start,
    periodEnd: addMonths(start, months),
  });

  return c.json({
    subscription: subscription
      ? {
          id: subscription.id,
          planName: plan.name,
          status: subscription.status,
          periodStart: subscription.periodStart.toISOString(),
          periodEnd: subscription.periodEnd.toISOString(),
        }
      : null,
  });
});

adminRoute.patch("/users/:id/role", zValidator("json", setRoleSchema), async (c) => {
  const { role } = c.req.valid("json");
  const current = c.get("user");

  if (current.id === c.req.param("id") && role !== "admin") {
    throw new HTTPException(400, { message: "You cannot remove your own admin role" });
  }

  const user = await setUserRole(db, c.req.param("id"), role);

  if (!user) {
    throw new HTTPException(404, { message: "User not found" });
  }

  return c.json({ user: { id: user.id, role: user.role } });
});

adminRoute.get("/users/:id/subscription", async (c) => {
  const subscription = await findSubscriptionForOwner(db, c.req.param("id"));

  return c.json({ subscription });
});
