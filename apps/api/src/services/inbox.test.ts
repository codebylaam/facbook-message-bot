import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { randomBytes } from "node:crypto";
import {
  createDb,
  fbPages,
  findConversationById,
  findOrCreateConversation,
  findOrCreateCustomer,
  insertMessage,
  listMessagesForConversation,
  recordInboundMessage,
  users,
} from "@fb-bot/db";
import { encryptToken, type GraphApi } from "@fb-bot/meta";
import { eq, inArray } from "drizzle-orm";
import {
  approveDraft,
  discardDraft,
  loadConversation,
  markInboxRead,
  sendHumanReply,
  setInboxMode,
} from "./inbox.ts";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is required to run the inbox tests");
}

const { db, close } = createDb(url, { max: 2 });
const encryptionKey = randomBytes(32);

const runId = crypto.randomUUID().slice(0, 8);
const owner = { id: `inbox-${runId}`, name: "Inbox", email: `ib-${runId}@test.local` };

let pageId = "";
let otherPageId = "";
let conversationId = "";
let draftId = "";

function graphStub() {
  const sends: string[] = [];
  const batch = crypto.randomUUID().slice(0, 8);

  const api: GraphApi = {
    request: async <T>(_path: string, options?: { body?: Record<string, unknown> }): Promise<T> => {
      const text = (options?.body?.message as { text?: string } | undefined)?.text;

      if (text) {
        sends.push(text);
      }

      return { message_id: `mid.out.${batch}.${sends.length}` } as T;
    },
  };

  return { api, sends };
}

const deps = (api: GraphApi = graphStub().api) => ({ db, graphApi: api, encryptionKey });

beforeAll(async () => {
  await db.insert(users).values([owner]);

  const [page] = await db
    .insert(fbPages)
    .values({
      ownerId: owner.id,
      fbPageId: `inbox-page-${runId}`,
      name: "Inbox Page",
      accessTokenEncrypted: encryptToken("page-token", encryptionKey),
    })
    .returning();

  const [other] = await db
    .insert(fbPages)
    .values({
      ownerId: owner.id,
      fbPageId: `inbox-other-${runId}`,
      name: "Other Page",
      accessTokenEncrypted: encryptToken("token-2", encryptionKey),
    })
    .returning();

  if (!page || !other) {
    throw new Error("failed to insert pages");
  }

  pageId = page.id;
  otherPageId = other.id;
});

beforeEach(async () => {
  const customer = await findOrCreateCustomer(db, pageId, `PSID_${runId}`);
  const conversation = await findOrCreateConversation(db, pageId, customer?.id ?? "");

  if (!conversation) {
    throw new Error("failed to create a conversation");
  }

  conversationId = conversation.id;

  await db
    .update((await import("@fb-bot/db")).conversations)
    .set({ mode: "bot", unreadCount: 0 })
    .where(eq((await import("@fb-bot/db")).conversations.id, conversationId));

  await insertMessage(db, {
    conversationId,
    mid: `mid.in.${crypto.randomUUID()}`,
    direction: "inbound",
    sender: "customer",
    text: "shirt er dam koto?",
  });
  await recordInboundMessage(db, conversationId);

  const draft = await insertMessage(db, {
    conversationId,
    direction: "outbound",
    sender: "bot",
    text: "শার্টের দাম ১২০০ টাকা।",
    isDraft: true,
    aiMetadata: { confidence: 0.4, intent: "pricing" },
  });

  if (!draft) {
    throw new Error("failed to insert the draft");
  }

  draftId = draft.id;
});

afterAll(async () => {
  await db.delete(fbPages).where(inArray(fbPages.id, [pageId, otherPageId]));
  await db.delete(users).where(eq(users.id, owner.id));
  await close();
});

describe("loadConversation", () => {
  test("returns the thread with the draft flagged", async () => {
    const result = await loadConversation(deps(), pageId, conversationId);

    expect(result.conversation.hasDraft).toBe(true);
    expect(result.messages.length).toBeGreaterThanOrEqual(2);
    expect(result.messages.some((message) => message.isDraft)).toBe(true);
  });

  test("carries the confidence and the intent of a bot message", async () => {
    const result = await loadConversation(deps(), pageId, conversationId);
    const draft = result.messages.find((message) => message.isDraft);

    expect(draft?.confidence).toBe(0.4);
    expect(draft?.intent).toBe("pricing");
  });

  test("refuses a conversation from another page", async () => {
    const error = await loadConversation(deps(), otherPageId, conversationId).catch(
      (thrown: unknown) => thrown,
    );

    expect((error as { status: number }).status).toBe(404);
  });
});

describe("sendHumanReply", () => {
  test("sends the text and stores it as a human message", async () => {
    const stub = graphStub();

    const message = await sendHumanReply(deps(stub.api), {
      pageId,
      conversationId,
      text: "জি, এল সাইজ আছে।",
    });

    expect(stub.sends).toEqual(["জি, এল সাইজ আছে।"]);
    expect(message.sender).toBe("human");
    expect(message.direction).toBe("outbound");
  });

  test("takes the conversation off the bot", async () => {
    await sendHumanReply(deps(), { pageId, conversationId, text: "আমি বলে দিচ্ছি" });

    const conversation = await findConversationById(db, conversationId);

    expect(conversation?.mode).toBe("human");
    expect(conversation?.handoffReason).toContain("inbox");
  });

  test("refuses a conversation from another page", async () => {
    const error = await sendHumanReply(deps(), {
      pageId: otherPageId,
      conversationId,
      text: "hello",
    }).catch((thrown: unknown) => thrown);

    expect((error as { status: number }).status).toBe(404);
  });
});

describe("approveDraft", () => {
  test("sends the draft text and clears the draft flag", async () => {
    const stub = graphStub();

    const sent = await approveDraft(deps(stub.api), { pageId, conversationId, draftId });

    expect(stub.sends).toEqual(["শার্টের দাম ১২০০ টাকা।"]);
    expect(sent.text).toBe("শার্টের দাম ১২০০ টাকা।");

    const messages = await listMessagesForConversation(db, conversationId);
    expect(messages.filter((message) => message.isDraft)).toHaveLength(0);
  });

  test("rejects an id that is not a draft", async () => {
    const messages = await listMessagesForConversation(db, conversationId);
    const plain = messages.find((message) => !message.isDraft);

    const error = await approveDraft(deps(), {
      pageId,
      conversationId,
      draftId: plain?.id ?? "",
    }).catch((thrown: unknown) => thrown);

    expect((error as { status: number }).status).toBe(404);
  });

  test("rejects a draft with no text", async () => {
    const empty = await insertMessage(db, {
      conversationId,
      direction: "outbound",
      sender: "bot",
      text: null,
      isDraft: true,
    });

    const error = await approveDraft(deps(), {
      pageId,
      conversationId,
      draftId: empty?.id ?? "",
    }).catch((thrown: unknown) => thrown);

    expect((error as { status: number }).status).toBe(400);
  });
});

describe("discardDraft", () => {
  test("clears every draft in the conversation", async () => {
    const discarded = await discardDraft(deps(), { pageId, conversationId });

    expect(discarded).toBeGreaterThanOrEqual(1);

    const messages = await listMessagesForConversation(db, conversationId);
    expect(messages.filter((message) => message.isDraft)).toHaveLength(0);
  });
});

describe("setInboxMode", () => {
  test("takes over and hands back", async () => {
    await setInboxMode(deps(), { pageId, conversationId, mode: "human" });
    expect((await findConversationById(db, conversationId))?.mode).toBe("human");

    await setInboxMode(deps(), { pageId, conversationId, mode: "bot" });
    expect((await findConversationById(db, conversationId))?.mode).toBe("bot");
  });

  test("refuses a conversation from another page", async () => {
    const error = await setInboxMode(deps(), {
      pageId: otherPageId,
      conversationId,
      mode: "human",
    }).catch((thrown: unknown) => thrown);

    expect((error as { status: number }).status).toBe(404);
  });
});

describe("markInboxRead", () => {
  test("clears the unread count", async () => {
    const before = await findConversationById(db, conversationId);
    expect(before?.unreadCount).toBeGreaterThan(0);

    await markInboxRead(deps(), { pageId, conversationId });

    expect((await findConversationById(db, conversationId))?.unreadCount).toBe(0);
  });
});
