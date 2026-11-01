import {
  conversationIdsWithDrafts,
  countInboxConversations,
  listInboxConversations,
  updateMessageText,
} from "@fb-bot/db";
import { conversationFilterSchema, sendMessageSchema, updateDraftSchema } from "@fb-bot/shared";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { db } from "../db.ts";
import { getEncryptionKey, graphApi } from "../meta.ts";
import { type AppEnv, requireSession } from "../middleware/auth.ts";
import {
  approveDraft,
  discardDraft,
  type InboxDeps,
  loadConversation,
  markInboxRead,
  sendHumanReply,
  setInboxMode,
  toConversation,
} from "../services/inbox.ts";
import { resolveOwnedPageId } from "./page-scope.ts";

export const conversationsRoute = new Hono<AppEnv>();

conversationsRoute.use("*", requireSession);

function deps(): InboxDeps {
  return { db, graphApi, encryptionKey: getEncryptionKey() };
}

function toHttp(error: unknown): never {
  if (error instanceof Error && "status" in error) {
    const status = (error as { status: number }).status;
    throw new HTTPException(status as 400, { message: error.message });
  }

  throw error;
}

conversationsRoute.get("/", async (c) => {
  const user = c.get("user");
  const pageId = await resolveOwnedPageId(db, user.id, c.req.query("pageId"));
  const parsed = conversationFilterSchema.safeParse(c.req.query("filter") ?? "all");
  const filter = parsed.success ? parsed.data : "all";
  const limit = Math.min(Number(c.req.query("limit") ?? 50) || 50, 100);
  const offset = Math.max(Number(c.req.query("offset") ?? 0) || 0, 0);

  const rows = await listInboxConversations(db, pageId, { filter, limit, offset });
  const drafts = await conversationIdsWithDrafts(
    db,
    rows.map((row) => row.id),
  );

  return c.json({
    pageId,
    filter,
    conversations: rows.map((row) => toConversation(row, drafts.has(row.id))),
    total: await countInboxConversations(db, pageId, filter),
  });
});

conversationsRoute.get("/:id", async (c) => {
  const user = c.get("user");
  const pageId = await resolveOwnedPageId(db, user.id, c.req.query("pageId"));

  try {
    return c.json(await loadConversation(deps(), pageId, c.req.param("id")));
  } catch (error) {
    toHttp(error);
  }
});

conversationsRoute.post("/:id/messages", zValidator("json", sendMessageSchema), async (c) => {
  const user = c.get("user");
  const pageId = await resolveOwnedPageId(db, user.id, c.req.query("pageId"));

  try {
    const message = await sendHumanReply(deps(), {
      pageId,
      conversationId: c.req.param("id"),
      text: c.req.valid("json").text,
    });

    return c.json({ message }, 201);
  } catch (error) {
    toHttp(error);
  }
});

conversationsRoute.patch(
  "/:id/drafts/:draftId",
  zValidator("json", updateDraftSchema),
  async (c) => {
    const user = c.get("user");
    const pageId = await resolveOwnedPageId(db, user.id, c.req.query("pageId"));
    const conversation = await loadConversation(deps(), pageId, c.req.param("id"));
    const draft = conversation.messages.find((message) => message.id === c.req.param("draftId"));

    if (!draft?.isDraft) {
      throw new HTTPException(404, { message: "Draft not found" });
    }

    const updated = await updateMessageText(db, c.req.param("draftId"), c.req.valid("json").text);

    if (!updated) {
      throw new HTTPException(404, { message: "Draft not found" });
    }

    return c.json({ message: { ...draft, text: updated.text } });
  },
);

conversationsRoute.post("/:id/drafts/:draftId/approve", async (c) => {
  const user = c.get("user");
  const pageId = await resolveOwnedPageId(db, user.id, c.req.query("pageId"));

  try {
    const message = await approveDraft(deps(), {
      pageId,
      conversationId: c.req.param("id"),
      draftId: c.req.param("draftId"),
    });

    return c.json({ message }, 201);
  } catch (error) {
    toHttp(error);
  }
});

conversationsRoute.delete("/:id/drafts", async (c) => {
  const user = c.get("user");
  const pageId = await resolveOwnedPageId(db, user.id, c.req.query("pageId"));

  try {
    const discarded = await discardDraft(deps(), { pageId, conversationId: c.req.param("id") });
    return c.json({ discarded });
  } catch (error) {
    toHttp(error);
  }
});

conversationsRoute.post("/:id/takeover", async (c) => {
  const user = c.get("user");
  const pageId = await resolveOwnedPageId(db, user.id, c.req.query("pageId"));

  try {
    const conversation = await setInboxMode(deps(), {
      pageId,
      conversationId: c.req.param("id"),
      mode: "human",
    });

    return c.json({
      conversation: conversation ? { id: conversation.id, mode: conversation.mode } : null,
    });
  } catch (error) {
    toHttp(error);
  }
});

conversationsRoute.post("/:id/handback", async (c) => {
  const user = c.get("user");
  const pageId = await resolveOwnedPageId(db, user.id, c.req.query("pageId"));

  try {
    const conversation = await setInboxMode(deps(), {
      pageId,
      conversationId: c.req.param("id"),
      mode: "bot",
    });

    return c.json({
      conversation: conversation ? { id: conversation.id, mode: conversation.mode } : null,
    });
  } catch (error) {
    toHttp(error);
  }
});

conversationsRoute.post("/:id/read", async (c) => {
  const user = c.get("user");
  const pageId = await resolveOwnedPageId(db, user.id, c.req.query("pageId"));

  try {
    await markInboxRead(deps(), { pageId, conversationId: c.req.param("id") });
    return c.json({ success: true });
  } catch (error) {
    toHttp(error);
  }
});
