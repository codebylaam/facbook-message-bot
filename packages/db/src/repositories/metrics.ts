import { and, count, eq } from "drizzle-orm";
import type { Db } from "../client.ts";
import { conversations, leads, messages } from "../schema/conversations.ts";
import { products } from "../schema/knowledge.ts";

export type PageMetrics = {
  conversations: number;
  inHumanMode: number;
  inboundMessages: number;
  botMessages: number;
  humanMessages: number;
  leads: number;
  draftProducts: number;
};

export async function getPageMetrics(db: Db, pageId: string): Promise<PageMetrics> {
  const [conversationTotal] = await db
    .select({ total: count() })
    .from(conversations)
    .where(eq(conversations.pageId, pageId));

  const [humanTotal] = await db
    .select({ total: count() })
    .from(conversations)
    .where(and(eq(conversations.pageId, pageId), eq(conversations.mode, "human")));

  const messageCounts = await db
    .select({ sender: messages.sender, total: count() })
    .from(messages)
    .innerJoin(conversations, eq(messages.conversationId, conversations.id))
    .where(eq(conversations.pageId, pageId))
    .groupBy(messages.sender);

  const [leadTotal] = await db
    .select({ total: count() })
    .from(leads)
    .where(eq(leads.pageId, pageId));

  const [draftTotal] = await db
    .select({ total: count() })
    .from(products)
    .where(and(eq(products.pageId, pageId), eq(products.status, "draft")));

  const bySender = new Map(messageCounts.map((row) => [row.sender, Number(row.total)]));

  return {
    conversations: Number(conversationTotal?.total ?? 0),
    inHumanMode: Number(humanTotal?.total ?? 0),
    inboundMessages: bySender.get("customer") ?? 0,
    botMessages: bySender.get("bot") ?? 0,
    humanMessages: bySender.get("human") ?? 0,
    leads: Number(leadTotal?.total ?? 0),
    draftProducts: Number(draftTotal?.total ?? 0),
  };
}

/** Bot replies as a share of every reply sent, so the seller sees the split. */
export function autoReplyRate(metrics: PageMetrics): number {
  const total = metrics.botMessages + metrics.humanMessages;

  return total === 0 ? 0 : metrics.botMessages / total;
}
