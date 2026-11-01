import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { randomBytes } from "node:crypto";
import type { ChatResult, LlmClient } from "@fb-bot/ai";
import {
  conversations,
  countAiReplies,
  createDb,
  fbPages,
  findConversationById,
  findOrCreateConversation,
  findOrCreateCustomer,
  insertMessage,
  leads,
  listMessagesForConversation,
  periodStartFor,
  recordInboundMessage,
  users,
} from "@fb-bot/db";
import { encryptToken, type GraphApi } from "@fb-bot/meta";
import { eq, inArray } from "drizzle-orm";
import type { WorkerDeps } from "../deps.ts";
import { handleReply } from "./reply.ts";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is required to run the reply job tests");
}

const { db, close } = createDb(url, { max: 2 });
const encryptionKey = randomBytes(32);

const runId = crypto.randomUUID().slice(0, 8);
const owner = { id: `reply-${runId}`, name: "Reply", email: `rp-${runId}@test.local` };

let pageId = "";
let conversationId = "";
let psid = "";

const REWRITE = '{"query":"shirt price","intent":"pricing","language":"banglish"}';

function answer(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    reply: "শার্টের দাম ১২০০ টাকা।",
    confidence: 0.92,
    needs_human: false,
    handoff_reason: null,
    intent: "pricing",
    source_ids: [],
    lead: null,
    ...overrides,
  });
}

function createGraphStub() {
  const actions: string[] = [];
  const sends: string[] = [];

  const api: GraphApi = {
    request: async <T>(_path: string, options?: { body?: Record<string, unknown> }): Promise<T> => {
      const body = options?.body ?? {};

      if (typeof body.sender_action === "string") {
        actions.push(body.sender_action);
      }

      const message = body.message as { text?: string } | undefined;

      if (message?.text) {
        sends.push(message.text);
      }

      return { message_id: `mid.out.${sends.length}`, recipient_id: psid } as T;
    },
  };

  return { api, actions, sends };
}

function scriptedLlm(generated: string, onGenerate?: () => Promise<void>): LlmClient {
  let call = 0;

  return {
    chat: async (): Promise<ChatResult> => {
      call += 1;

      if (call === 1) {
        return { content: REWRITE, model: "test", usage: {} };
      }

      await onGenerate?.();

      return { content: generated, model: "test", usage: { totalTokens: 50 } };
    },
  };
}

function deps(overrides: Partial<WorkerDeps> = {}): WorkerDeps {
  const stub = createGraphStub();

  return {
    db,
    graphApi: stub.api,
    llm: scriptedLlm(answer()),
    embeddings: null,
    encryptionKey,
    ...overrides,
  };
}

const enqueued: string[] = [];
const options = {
  enqueueReply: async (id: string) => {
    enqueued.push(id);
  },
  typingDelayMs: 0,
};

async function freshConversation(suffix: string, text: string | null) {
  const customer = await findOrCreateCustomer(db, pageId, `${psid}-${suffix}`);
  const conversation = await findOrCreateConversation(db, pageId, customer?.id ?? "");

  if (!conversation) {
    throw new Error("failed to create a conversation");
  }

  await insertMessage(db, {
    conversationId: conversation.id,
    mid: `mid.${suffix}.${crypto.randomUUID()}`,
    direction: "inbound",
    sender: "customer",
    text,
    attachments: text === null ? [{ type: "image", url: "https://img/1.jpg" }] : [],
  });
  await recordInboundMessage(db, conversation.id);

  return conversation.id;
}

beforeAll(async () => {
  await db.insert(users).values([owner]);

  const [page] = await db
    .insert(fbPages)
    .values({
      ownerId: owner.id,
      fbPageId: `reply-page-${runId}`,
      name: "Reply Page",
      accessTokenEncrypted: encryptToken("page-token", encryptionKey),
      confidenceThreshold: 0.7,
    })
    .returning();

  if (!page) {
    throw new Error("failed to insert the page");
  }

  pageId = page.id;
  psid = `PSID_${runId}`;
});

beforeEach(async () => {
  enqueued.length = 0;

  await db.update(fbPages).set({ botEnabled: true }).where(eq(fbPages.id, pageId));

  const customer = await findOrCreateCustomer(db, pageId, psid);
  const conversation = await findOrCreateConversation(db, pageId, customer?.id ?? "");

  if (!conversation) {
    throw new Error("failed to create the conversation");
  }

  conversationId = conversation.id;

  await db
    .update(conversations)
    .set({ mode: "bot", handoffReason: null, messageCount: 0 })
    .where(eq(conversations.id, conversationId));

  await insertMessage(db, {
    conversationId,
    mid: `mid.in.${crypto.randomUUID()}`,
    direction: "inbound",
    sender: "customer",
    text: "shirt er dam koto?",
  });

  await recordInboundMessage(db, conversationId);
});

afterAll(async () => {
  await db.delete(fbPages).where(inArray(fbPages.id, [pageId]));
  await db.delete(users).where(eq(users.id, owner.id));
  await close();
});

describe("handleReply", () => {
  test("sends a confident answer with typing indicators", async () => {
    const stub = createGraphStub();

    const result = await handleReply(deps({ graphApi: stub.api }), { conversationId }, options);

    expect(result.action).toBe("sent");
    expect(stub.actions).toEqual(["mark_seen", "typing_on", "typing_off"]);
    expect(stub.sends).toEqual(["শার্টের দাম ১২০০ টাকা।"]);
  });

  test("stores the sent reply as an outbound message", async () => {
    await handleReply(deps(), { conversationId }, options);

    const outbound = (await listMessagesForConversation(db, conversationId)).filter(
      (message) => message.direction === "outbound",
    );

    expect(outbound).toHaveLength(1);
    expect(outbound[0]?.sender).toBe("bot");
    expect(outbound[0]?.isDraft).toBe(false);
    expect(outbound[0]?.aiMetadata?.confidence).toBe(0.92);
  });

  test("counts the reply against the monthly quota", async () => {
    const before = await countAiReplies(db, owner.id, periodStartFor());

    await handleReply(deps(), { conversationId }, options);

    expect(await countAiReplies(db, owner.id, periodStartFor())).toBe(before + 1);
  });

  test("hands off low confidence without sending anything", async () => {
    const stub = createGraphStub();
    const llm = scriptedLlm(answer({ confidence: 0.2 }));

    const result = await handleReply(
      deps({ graphApi: stub.api, llm }),
      { conversationId },
      options,
    );

    expect(result.action).toBe("handoff");
    expect(stub.sends).toHaveLength(0);

    const conversation = await findConversationById(db, conversationId);
    expect(conversation?.mode).toBe("human");
    expect(conversation?.handoffReason).toContain("below the threshold");
  });

  test("keeps the model's text as a draft on handoff", async () => {
    const llm = scriptedLlm(answer({ confidence: 0.2 }));

    await handleReply(deps({ llm }), { conversationId }, options);

    const draft = (await listMessagesForConversation(db, conversationId)).find(
      (message) => message.isDraft,
    );

    expect(draft?.text).toBe("শার্টের দাম ১২০০ টাকা।");
  });

  test("still counts usage when it hands off", async () => {
    const before = await countAiReplies(db, owner.id, periodStartFor());
    const llm = scriptedLlm(answer({ needs_human: true, handoff_reason: "not in the catalog" }));

    await handleReply(deps({ llm }), { conversationId }, options);

    expect(await countAiReplies(db, owner.id, periodStartFor())).toBe(before + 1);
  });

  test("captures a lead and hands it to a human", async () => {
    const llm = scriptedLlm(
      answer({
        lead: {
          name: "Karim",
          phone: "01700000000",
          address: "Mirpur",
          items: [{ name: "Cotton Shirt", quantity: 2, variant: "L" }],
        },
      }),
    );

    const result = await handleReply(deps({ llm }), { conversationId }, options);

    expect(result.action).toBe("handoff");

    const rows = await db.select().from(leads).where(eq(leads.pageId, pageId));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.phone).toBe("01700000000");
    expect(rows[0]?.items).toHaveLength(1);
  });

  test("skips when the bot is turned off", async () => {
    await db.update(fbPages).set({ botEnabled: false }).where(eq(fbPages.id, pageId));

    const result = await handleReply(deps(), { conversationId }, options);

    expect(result.action).toBe("skipped");
    expect(result.reason).toContain("turned off");
  });

  test("skips when the conversation is already with a human", async () => {
    await db
      .update(conversations)
      .set({ mode: "human" })
      .where(eq(conversations.id, conversationId));

    const result = await handleReply(deps(), { conversationId }, options);

    expect(result.action).toBe("skipped");
    expect(result.reason).toContain("human mode");
  });

  test("skips when the customer's message is older than the window", async () => {
    await db
      .update(conversations)
      .set({ lastCustomerMsgAt: new Date(Date.now() - 30 * 60 * 60 * 1000) })
      .where(eq(conversations.id, conversationId));

    const result = await handleReply(deps(), { conversationId }, options);

    expect(result.action).toBe("skipped");
    expect(result.reason).toContain("24 hours");
  });

  test("hands off a message that carries only an attachment", async () => {
    const imageOnly = await freshConversation("image", null);

    const result = await handleReply(deps(), { conversationId: imageOnly }, options);

    expect(result.action).toBe("handoff");
    expect(result.reason).toContain("only attachments");

    const conversation = await findConversationById(db, imageOnly);
    expect(conversation?.mode).toBe("human");
  });

  test("requeues when another message arrives while it is working", async () => {
    const llm = scriptedLlm(answer(), async () => {
      await insertMessage(db, {
        conversationId,
        mid: `mid.late.${crypto.randomUUID()}`,
        direction: "inbound",
        sender: "customer",
        text: "আর ডেলিভারি চার্জ?",
      });
      await recordInboundMessage(db, conversationId);
    });

    const result = await handleReply(deps({ llm }), { conversationId }, options);

    expect(result.action).toBe("requeued");
    expect(enqueued).toEqual([conversationId]);
  });

  test("skips a conversation with nothing to answer", async () => {
    const quiet = await freshConversation("quiet", "hello");

    // Mark the only message as answered by adding an outbound reply after it.
    await insertMessage(db, {
      conversationId: quiet,
      mid: `mid.out.quiet.${crypto.randomUUID()}`,
      direction: "outbound",
      sender: "human",
      text: "answered by hand",
    });

    const result = await handleReply(deps(), { conversationId: quiet }, options);

    expect(result.action).toBe("skipped");
    expect(result.reason).toContain("no unanswered messages");
  });

  test("skips a conversation that no longer exists", async () => {
    const result = await handleReply(
      deps(),
      { conversationId: "00000000-0000-0000-0000-000000000000" },
      options,
    );

    expect(result.action).toBe("skipped");
    expect(result.reason).toContain("no longer exists");
  });
});
