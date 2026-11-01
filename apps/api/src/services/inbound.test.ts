import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
  createDb,
  customers,
  fbPages,
  findConversationForCustomer,
  listMessagesForConversation,
  users,
} from "@fb-bot/db";
import type { WebhookEntry } from "@fb-bot/meta";
import { eq, inArray } from "drizzle-orm";
import { handleMessageEntry } from "./inbound.ts";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is required to run the inbound tests");
}

const { db, close } = createDb(url, { max: 2 });

const runId = crypto.randomUUID().slice(0, 8);
const owner = { id: `inbound-${runId}`, name: "Inbound", email: `in-${runId}@test.local` };
const FB_PAGE_ID = `inbound-page-${runId}`;

let pageId = "";
const enqueued: string[] = [];

function deps() {
  return {
    db,
    enqueueReply: async (conversationId: string) => {
      enqueued.push(conversationId);
    },
  };
}

function entry(overrides: Partial<Record<string, unknown>> = {}): WebhookEntry {
  return {
    id: FB_PAGE_ID,
    messaging: [
      {
        sender: { id: "PSID_1" },
        recipient: { id: FB_PAGE_ID },
        message: { mid: "mid.1", text: "shirt er dam koto?" },
      },
    ],
    ...overrides,
  } as WebhookEntry;
}

function echoEntry(mid: string): WebhookEntry {
  return {
    id: FB_PAGE_ID,
    messaging: [
      {
        sender: { id: FB_PAGE_ID },
        recipient: { id: "PSID_1" },
        message: { mid, text: "আমি নিজে উত্তর দিচ্ছি", is_echo: true },
      },
    ],
  } as WebhookEntry;
}

beforeAll(async () => {
  await db.insert(users).values([owner]);

  const [page] = await db
    .insert(fbPages)
    .values({
      ownerId: owner.id,
      fbPageId: FB_PAGE_ID,
      name: "Inbound Page",
      accessTokenEncrypted: "enc",
    })
    .returning();

  if (!page) {
    throw new Error("failed to insert the page");
  }

  pageId = page.id;
});

afterAll(async () => {
  await db.delete(fbPages).where(inArray(fbPages.id, [pageId]));
  await db.delete(users).where(eq(users.id, owner.id));
  await close();
});

describe("handleMessageEntry", () => {
  test("stores an inbound message and enqueues one reply", async () => {
    const result = await handleMessageEntry(deps(), entry());

    expect(result.stored).toBe(1);
    expect(result.enqueued).toBe(1);
    expect(enqueued).toHaveLength(1);
  });

  test("creates the customer and the conversation on first contact", async () => {
    const [customer] = await db
      .select()
      .from(customers)
      .where(eq(customers.pageId, pageId))
      .limit(1);

    expect(customer?.psid).toBe("PSID_1");

    const conversation = await findConversationForCustomer(db, pageId, customer?.id ?? "");

    expect(conversation?.mode).toBe("bot");
    expect(conversation?.lastCustomerMsgAt).not.toBeNull();
    expect(conversation?.messageCount).toBe(1);
  });

  test("drops a duplicate delivery without enqueueing again", async () => {
    enqueued.length = 0;

    const result = await handleMessageEntry(deps(), entry());

    expect(result.duplicates).toBe(1);
    expect(result.stored).toBe(0);
    expect(enqueued).toHaveLength(0);
  });

  test("reuses the conversation for a second message from the same person", async () => {
    enqueued.length = 0;

    const second = {
      id: FB_PAGE_ID,
      messaging: [
        {
          sender: { id: "PSID_1" },
          recipient: { id: FB_PAGE_ID },
          message: { mid: "mid.2", text: "L size ache?" },
        },
      ],
    } as WebhookEntry;

    const result = await handleMessageEntry(deps(), second);

    expect(result.stored).toBe(1);
    expect(enqueued).toHaveLength(1);

    const [customer] = await db
      .select()
      .from(customers)
      .where(eq(customers.pageId, pageId))
      .limit(1);
    const conversation = await findConversationForCustomer(db, pageId, customer?.id ?? "");
    const messages = await listMessagesForConversation(db, conversation?.id ?? "");

    expect(messages.map((message) => message.text)).toEqual(["shirt er dam koto?", "L size ache?"]);
    expect(conversation?.messageCount).toBe(2);
  });

  test("switches the bot off when the seller answers from the Page inbox", async () => {
    const result = await handleMessageEntry(deps(), echoEntry("mid.echo.1"));

    expect(result.echoes).toBe(1);
    expect(result.enqueued).toBe(0);

    const [customer] = await db
      .select()
      .from(customers)
      .where(eq(customers.pageId, pageId))
      .limit(1);
    const conversation = await findConversationForCustomer(db, pageId, customer?.id ?? "");

    expect(conversation?.mode).toBe("human");
    expect(conversation?.handoffReason).toContain("Page inbox");
  });

  test("stores the echo as a message from a human", async () => {
    const [customer] = await db
      .select()
      .from(customers)
      .where(eq(customers.pageId, pageId))
      .limit(1);
    const conversation = await findConversationForCustomer(db, pageId, customer?.id ?? "");
    const messages = await listMessagesForConversation(db, conversation?.id ?? "");
    const echo = messages.find((message) => message.mid === "mid.echo.1");

    expect(echo?.sender).toBe("human");
    expect(echo?.direction).toBe("outbound");
    expect(echo?.isEcho).toBe(true);
  });

  test("ignores a page that is not connected", async () => {
    const result = await handleMessageEntry(deps(), {
      id: "UNKNOWN_PAGE",
      messaging: [
        {
          sender: { id: "PSID_9" },
          recipient: { id: "UNKNOWN_PAGE" },
          message: { mid: "mid.unknown", text: "hello" },
        },
      ],
    } as WebhookEntry);

    expect(result.skipped).toBe(1);
    expect(result.reason).toContain("not connected");
  });

  test("skips an event with no message payload", async () => {
    const result = await handleMessageEntry(deps(), {
      id: FB_PAGE_ID,
      messaging: [{ sender: { id: "PSID_1" }, recipient: { id: FB_PAGE_ID } }],
    } as WebhookEntry);

    expect(result.skipped).toBe(1);
  });

  test("keeps going through several messages in one entry", async () => {
    enqueued.length = 0;

    const result = await handleMessageEntry(deps(), {
      id: FB_PAGE_ID,
      messaging: [
        {
          sender: { id: "PSID_2" },
          recipient: { id: FB_PAGE_ID },
          message: { mid: "mid.3", text: "dam koto?" },
        },
        {
          sender: { id: "PSID_2" },
          recipient: { id: FB_PAGE_ID },
          message: { mid: "mid.4", text: "delivery charge?" },
        },
      ],
    } as WebhookEntry);

    expect(result.stored).toBe(2);
    expect(enqueued).toHaveLength(2);
    expect(new Set(enqueued).size).toBe(1);
  });
});
