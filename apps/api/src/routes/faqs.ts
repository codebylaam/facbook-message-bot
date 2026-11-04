import {
  createFaqForPage,
  deleteChunksForSource,
  deleteFaqForPage,
  listFaqsForPage,
  updateFaqForPage,
} from "@fb-bot/db";
import { createFaqSchema, QUEUES, updateFaqSchema } from "@fb-bot/shared";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { db } from "../db.ts";
import { type AppEnv, requireSession } from "../middleware/auth.ts";
import { enqueue } from "../queue.ts";
import { resolveOwnedPageId } from "./page-scope.ts";

export const faqsRoute = new Hono<AppEnv>();

faqsRoute.use("*", requireSession);

type FaqRow = Awaited<ReturnType<typeof listFaqsForPage>>[number];

function toFaq(row: FaqRow) {
  return {
    id: row.id,
    question: row.question,
    answer: row.answer,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

faqsRoute.get("/", async (c) => {
  const user = c.get("user");
  const pageId = await resolveOwnedPageId(db, user.id, c.req.query("pageId"));
  const faqs = await listFaqsForPage(db, pageId);

  return c.json({ pageId, faqs: faqs.map(toFaq) });
});

faqsRoute.post("/", zValidator("json", createFaqSchema), async (c) => {
  const user = c.get("user");
  const pageId = await resolveOwnedPageId(db, user.id, c.req.query("pageId"));
  const faq = await createFaqForPage(db, pageId, c.req.valid("json"));

  if (!faq) {
    throw new HTTPException(500, { message: "Could not save the FAQ" });
  }

  await enqueue(QUEUES.reembed, { pageId, sourceType: "faq", sourceId: faq.id });

  return c.json({ faq: toFaq(faq) }, 201);
});

faqsRoute.patch("/:id", zValidator("json", updateFaqSchema), async (c) => {
  const user = c.get("user");
  const pageId = await resolveOwnedPageId(db, user.id, c.req.query("pageId"));
  const faq = await updateFaqForPage(db, pageId, c.req.param("id"), c.req.valid("json"));

  if (!faq) {
    throw new HTTPException(404, { message: "FAQ not found" });
  }

  await enqueue(QUEUES.reembed, { pageId, sourceType: "faq", sourceId: faq.id });

  return c.json({ faq: toFaq(faq) });
});

faqsRoute.delete("/:id", async (c) => {
  const user = c.get("user");
  const pageId = await resolveOwnedPageId(db, user.id, c.req.query("pageId"));
  const removed = await deleteFaqForPage(db, pageId, c.req.param("id"));

  if (!removed) {
    throw new HTTPException(404, { message: "FAQ not found" });
  }

  // Without this the deleted answer stays retrievable, and the bot keeps quoting it.
  await deleteChunksForSource(db, pageId, "faq", c.req.param("id"));

  return c.json({ success: true });
});
