import { findPageByFbPageId, markWebhookEvent, recordWebhookEvent } from "@fb-bot/db";
import { parseWebhookPayload, SIGNATURE_HEADER, verifySignature } from "@fb-bot/meta";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { db } from "../db.ts";
import { env, isMetaConfigured } from "../env.ts";

export const webhookRoute = new Hono();

webhookRoute.get("/", (c) => {
  const mode = c.req.query("hub.mode");
  const token = c.req.query("hub.verify_token");
  const challenge = c.req.query("hub.challenge");

  if (mode !== "subscribe" || !challenge) {
    return c.text("Bad Request", 400);
  }

  if (!isMetaConfigured || token !== env.META_VERIFY_TOKEN) {
    return c.text("Forbidden", 403);
  }

  return c.text(challenge);
});

webhookRoute.post("/", async (c) => {
  if (!isMetaConfigured) {
    throw new HTTPException(503, {
      message: "The Facebook app is not configured on this server",
    });
  }

  const rawBody = await c.req.text();

  if (
    !verifySignature({
      rawBody,
      appSecret: env.META_APP_SECRET,
      signature: c.req.header(SIGNATURE_HEADER),
    })
  ) {
    throw new HTTPException(401, { message: "Invalid webhook signature" });
  }

  let entries: ReturnType<typeof parseWebhookPayload>;

  try {
    entries = parseWebhookPayload(rawBody);
  } catch (error) {
    console.error("[api] could not parse a signature-verified webhook", error);
    throw new HTTPException(400, { message: "Unrecognised webhook payload" });
  }

  for (const entry of entries) {
    const page = await findPageByFbPageId(db, entry.fbPageId);

    const record = await recordWebhookEvent(db, {
      fbPageId: entry.fbPageId,
      object: entry.object,
      field: entry.field,
      raw: entry.entry,
      pageId: page?.id ?? null,
    });

    if (record && entry.field === "unknown") {
      await markWebhookEvent(db, { id: record.id, status: "ignored" });
    }
  }

  return c.json({ received: true });
});
