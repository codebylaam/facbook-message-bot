import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { eq, inArray } from "drizzle-orm";
import { createDb } from "../client.ts";
import { users } from "../schema/auth.ts";
import { conversations, customers, leads, messages } from "../schema/conversations.ts";
import { products } from "../schema/knowledge.ts";
import { fbPages } from "../schema/pages.ts";
import { autoReplyRate, getPageMetrics } from "./metrics.ts";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is required to run the metrics tests");
}

const { db, close } = createDb(url, { max: 2 });

const runId = crypto.randomUUID().slice(0, 8);
const owner = { id: `mtr-${runId}`, name: "Metrics", email: `mt-${runId}@test.local` };

let pageId = "";
let conversationId = "";
let customerId = "";

beforeAll(async () => {
  await db.insert(users).values([owner]);

  const [page] = await db
    .insert(fbPages)
    .values({
      ownerId: owner.id,
      fbPageId: `mtr-page-${runId}`,
      name: "Metrics Page",
      accessTokenEncrypted: "enc",
    })
    .returning();

  if (!page) {
    throw new Error("failed to insert the page");
  }

  pageId = page.id;

  const [customer] = await db
    .insert(customers)
    .values({ pageId, psid: `PSID_${runId}`, name: "Karim" })
    .returning();

  if (!customer) {
    throw new Error("failed to insert the customer");
  }

  customerId = customer.id;

  const [conversation] = await db
    .insert(conversations)
    .values({ pageId, customerId, mode: "human" })
    .returning();

  if (!conversation) {
    throw new Error("failed to insert the conversation");
  }

  conversationId = conversation.id;

  await db.insert(messages).values([
    { conversationId, direction: "inbound", sender: "customer", text: "dam koto?" },
    { conversationId, direction: "inbound", sender: "customer", text: "L ache?" },
    { conversationId, direction: "outbound", sender: "bot", text: "১২০০ টাকা" },
    { conversationId, direction: "outbound", sender: "human", text: "আমি বলছি" },
  ]);

  await db.insert(leads).values({ pageId, conversationId, customerId, phone: "01700000000" });

  await db.insert(products).values([
    { pageId, name: "Draft one", source: "extracted", status: "draft" },
    { pageId, name: "Live one", source: "manual", status: "active" },
  ]);
});

afterAll(async () => {
  await db.delete(fbPages).where(inArray(fbPages.id, [pageId]));
  await db.delete(users).where(eq(users.id, owner.id));
  await close();
});

describe("getPageMetrics", () => {
  test("counts conversations and which ones a human owns", async () => {
    const metrics = await getPageMetrics(db, pageId);

    expect(metrics.conversations).toBe(1);
    expect(metrics.inHumanMode).toBe(1);
  });

  test("splits messages by who sent them", async () => {
    const metrics = await getPageMetrics(db, pageId);

    expect(metrics.inboundMessages).toBe(2);
    expect(metrics.botMessages).toBe(1);
    expect(metrics.humanMessages).toBe(1);
  });

  test("counts leads and draft products", async () => {
    const metrics = await getPageMetrics(db, pageId);

    expect(metrics.leads).toBe(1);
    expect(metrics.draftProducts).toBe(1);
  });

  test("counts nothing for a page with no activity", async () => {
    const metrics = await getPageMetrics(db, "00000000-0000-0000-0000-000000000000");

    expect(metrics.conversations).toBe(0);
    expect(metrics.inboundMessages).toBe(0);
  });
});

describe("autoReplyRate", () => {
  test("is the bot share of every reply", async () => {
    const metrics = await getPageMetrics(db, pageId);

    expect(autoReplyRate(metrics)).toBe(0.5);
  });

  test("is zero when nobody has replied", () => {
    expect(
      autoReplyRate({
        conversations: 0,
        inHumanMode: 0,
        inboundMessages: 3,
        botMessages: 0,
        humanMessages: 0,
        leads: 0,
        draftProducts: 0,
      }),
    ).toBe(0);
  });
});
