import { and, count, desc, eq, gt, inArray, sql } from "drizzle-orm";
import type { Db } from "../client.ts";
import { conversations, customers, messages } from "../schema/conversations.ts";

export type InboxFilter = "all" | "needs_attention" | "bot" | "human";

export type InboxRow = {
  id: string;
  pageId: string;
  customerId: string;
  customerName: string | null;
  customerPsid: string;
  mode: "bot" | "human" | "paused";
  status: "open" | "closed";
  handoffReason: string | null;
  lastMessageAt: Date | null;
  lastCustomerMsgAt: Date | null;
  unreadCount: number;
  messageCount: number;
  summary: string | null;
};

function filterCondition(pageId: string, filter: InboxFilter) {
  const scope = eq(conversations.pageId, pageId);

  if (filter === "bot") {
    return and(scope, eq(conversations.mode, "bot"));
  }

  if (filter === "human") {
    return and(scope, eq(conversations.mode, "human"));
  }

  if (filter === "needs_attention") {
    return and(scope, gt(conversations.unreadCount, 0));
  }

  return scope;
}

export async function listInboxConversations(
  db: Db,
  pageId: string,
  options: { filter?: InboxFilter; limit?: number; offset?: number } = {},
): Promise<InboxRow[]> {
  const filter = options.filter ?? "all";

  const rows = await db
    .select({
      id: conversations.id,
      pageId: conversations.pageId,
      customerId: conversations.customerId,
      customerName: customers.name,
      customerPsid: customers.psid,
      mode: conversations.mode,
      status: conversations.status,
      handoffReason: conversations.handoffReason,
      lastMessageAt: conversations.lastMessageAt,
      lastCustomerMsgAt: conversations.lastCustomerMsgAt,
      unreadCount: conversations.unreadCount,
      messageCount: conversations.messageCount,
      summary: conversations.summary,
    })
    .from(conversations)
    .innerJoin(customers, eq(conversations.customerId, customers.id))
    .where(filterCondition(pageId, filter))
    .orderBy(desc(conversations.lastMessageAt), sql`${conversations.id} desc`)
    .limit(options.limit ?? 50)
    .offset(options.offset ?? 0);

  return rows;
}

export async function countInboxConversations(db: Db, pageId: string, filter: InboxFilter = "all") {
  const [row] = await db
    .select({ total: count() })
    .from(conversations)
    .where(filterCondition(pageId, filter));

  return row?.total ?? 0;
}

export async function findInboxConversation(db: Db, pageId: string, conversationId: string) {
  const [row] = await db
    .select({
      id: conversations.id,
      pageId: conversations.pageId,
      customerId: conversations.customerId,
      customerName: customers.name,
      customerPsid: customers.psid,
      mode: conversations.mode,
      status: conversations.status,
      handoffReason: conversations.handoffReason,
      lastMessageAt: conversations.lastMessageAt,
      lastCustomerMsgAt: conversations.lastCustomerMsgAt,
      unreadCount: conversations.unreadCount,
      messageCount: conversations.messageCount,
      summary: conversations.summary,
    })
    .from(conversations)
    .innerJoin(customers, eq(conversations.customerId, customers.id))
    .where(and(eq(conversations.pageId, pageId), eq(conversations.id, conversationId)))
    .limit(1);

  return row;
}

export async function listThreadMessages(db: Db, conversationId: string, limit = 200) {
  const rows = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(desc(messages.createdAt))
    .limit(limit);

  return rows.reverse();
}

export async function conversationIdsWithDrafts(db: Db, conversationIds: string[]) {
  if (conversationIds.length === 0) {
    return new Set<string>();
  }

  const rows = await db
    .select({ conversationId: messages.conversationId })
    .from(messages)
    .where(and(inArray(messages.conversationId, conversationIds), eq(messages.isDraft, true)));

  return new Set(rows.map((row) => row.conversationId));
}
