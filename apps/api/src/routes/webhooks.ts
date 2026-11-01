import { findPageByFbPageId, markWebhookEvent, recordWebhookEvent } from "@fb-bot/db";
import { parseWebhookPayload, SIGNATURE_HEADER, verifySignature } from "@fb-bot/meta";
import { QUEUES } from "@fb-bot/shared";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { db } from "../db.ts";
import { env, isMetaConfigured } from "../env.ts";
import { enqueue } from "../queue.ts";
import { handleFeedEntry } from "../services/comments.ts";
import { handleMessageEntry } from "../services/inbound.ts";

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

/**
 * Meta retries on any slow or failed delivery, so the upsert of the raw event is
 * the only work that must not fail. Everything after it is best effort and logged.
 */
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

  const enqueueReply = async (conversationId: string) => {
    // One job per conversation, six seconds after the first message, so a burst
    // of short messages becomes a single answer.
    await enqueue(
      QUEUES.reply,
      { conversationId },
      {
        singletonKey: conversationId,
        startAfterSeconds: env.REPLY_DEBOUNCE_SECONDS,
      },
    );
  };

  const enqueueComment = async (commentId: string) => {
    await enqueue(QUEUES.comment, { commentId });
  };

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

    if (!record) {
      continue;
    }

    if (entry.field === "feed") {
      try {
        const outcome = await handleFeedEntry({ db, enqueueComment }, entry.entry);
        await markWebhookEvent(db, {
          id: record.id,
          status: outcome.reason ? "ignored" : "processed",
          error: outcome.reason,
        });
      } catch (error) {
        console.error("[api] could not process an inbound comment", error);
        await markWebhookEvent(db, {
          id: record.id,
          status: "failed",
          error: error instanceof Error ? error.message : "unknown error",
        });
      }

      continue;
    }

    if (entry.field !== "messages") {
      continue;
    }

    try {
      const outcome = await handleMessageEntry({ db, enqueueReply }, entry.entry);

      if (outcome.reason) {
        await markWebhookEvent(db, { id: record.id, status: "ignored", error: outcome.reason });
      } else {
        await markWebhookEvent(db, { id: record.id, status: "processed" });
      }
    } catch (error) {
      console.error("[api] could not process an inbound message", error);
      await markWebhookEvent(db, {
        id: record.id,
        status: "failed",
        error: error instanceof Error ? error.message : "unknown error",
      });
    }
  }

  return c.json({ received: true });
});
