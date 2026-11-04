import {
  createPolicyForPage,
  deleteChunksForSource,
  deletePolicyForPage,
  listPoliciesForPage,
  updatePolicyForPage,
} from "@fb-bot/db";
import { createPolicySchema, QUEUES, updatePolicySchema } from "@fb-bot/shared";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { db } from "../db.ts";
import { type AppEnv, requireSession } from "../middleware/auth.ts";
import { enqueue } from "../queue.ts";
import { resolveOwnedPageId } from "./page-scope.ts";

export const policiesRoute = new Hono<AppEnv>();

policiesRoute.use("*", requireSession);

type PolicyRow = Awaited<ReturnType<typeof listPoliciesForPage>>[number];

function toPolicy(row: PolicyRow) {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

policiesRoute.get("/", async (c) => {
  const user = c.get("user");
  const pageId = await resolveOwnedPageId(db, user.id, c.req.query("pageId"));
  const policies = await listPoliciesForPage(db, pageId);

  return c.json({ pageId, policies: policies.map(toPolicy) });
});

policiesRoute.post("/", zValidator("json", createPolicySchema), async (c) => {
  const user = c.get("user");
  const pageId = await resolveOwnedPageId(db, user.id, c.req.query("pageId"));
  const policy = await createPolicyForPage(db, pageId, c.req.valid("json"));

  if (!policy) {
    throw new HTTPException(500, { message: "Could not save the policy" });
  }

  await enqueue(QUEUES.reembed, { pageId, sourceType: "policy", sourceId: policy.id });

  return c.json({ policy: toPolicy(policy) }, 201);
});

policiesRoute.patch("/:id", zValidator("json", updatePolicySchema), async (c) => {
  const user = c.get("user");
  const pageId = await resolveOwnedPageId(db, user.id, c.req.query("pageId"));
  const policy = await updatePolicyForPage(db, pageId, c.req.param("id"), c.req.valid("json"));

  if (!policy) {
    throw new HTTPException(404, { message: "Policy not found" });
  }

  await enqueue(QUEUES.reembed, { pageId, sourceType: "policy", sourceId: policy.id });

  return c.json({ policy: toPolicy(policy) });
});

policiesRoute.delete("/:id", async (c) => {
  const user = c.get("user");
  const pageId = await resolveOwnedPageId(db, user.id, c.req.query("pageId"));
  const removed = await deletePolicyForPage(db, pageId, c.req.param("id"));

  if (!removed) {
    throw new HTTPException(404, { message: "Policy not found" });
  }

  // Without this the deleted policy stays retrievable, and the bot keeps quoting it.
  await deleteChunksForSource(db, pageId, "policy", c.req.param("id"));

  return c.json({ success: true });
});
