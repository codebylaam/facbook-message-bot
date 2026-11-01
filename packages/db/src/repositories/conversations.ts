import { and, eq, sql } from "drizzle-orm";
import type { Db } from "../client.ts";
import { conversations } from "../schema/conversations.ts";
import type { conversationModeEnum } from "../schema/enums.ts";

export type ConversationMode = (typeof conversationModeEnum.enumValues)[number];

export async function findConversationById(db: Db, conversationId: string) {
  const [conversation] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);

  return conversation;
}

export async function findConversationForCustomer(db: Db, pageId: string, customerId: string) {
  const [conversation] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.pageId, pageId), eq(conversations.customerId, customerId)))
    .limit(1);

  return conversation;
}

export async function findOrCreateConversation(db: Db, pageId: string, customerId: string) {
  const existing = await findConversationForCustomer(db, pageId, customerId);

  if (existing) {
    return existing;
  }

  const [created] = await db
    .insert(conversations)
    .values({ pageId, customerId })
    .onConflictDoNothing()
    .returning();

  return created ?? (await findConversationForCustomer(db, pageId, customerId));
}

export async function recordInboundMessage(db: Db, conversationId: string, at = new Date()) {
  const [conversation] = await db
    .update(conversations)
    .set({
      lastCustomerMsgAt: at,
      lastMessageAt: at,
      unreadCount: sql`${conversations.unreadCount} + 1`,
      messageCount: sql`${conversations.messageCount} + 1`,
      updatedAt: at,
    })
    .where(eq(conversations.id, conversationId))
    .returning();

  return conversation;
}

export async function recordOutboundMessage(db: Db, conversationId: string, at = new Date()) {
  const [conversation] = await db
    .update(conversations)
    .set({
      lastMessageAt: at,
      messageCount: sql`${conversations.messageCount} + 1`,
      unreadCount: 0,
      updatedAt: at,
    })
    .where(eq(conversations.id, conversationId))
    .returning();

  return conversation;
}

export async function setConversationMode(
  db: Db,
  conversationId: string,
  mode: ConversationMode,
  handoffReason?: string | null,
) {
  const [conversation] = await db
    .update(conversations)
    .set({
      mode,
      handoffReason: handoffReason ?? null,
      updatedAt: new Date(),
    })
    .where(eq(conversations.id, conversationId))
    .returning();

  return conversation;
}

export async function setConversationSummary(db: Db, conversationId: string, summary: string) {
  const [conversation] = await db
    .update(conversations)
    .set({ summary, updatedAt: new Date() })
    .where(eq(conversations.id, conversationId))
    .returning();

  return conversation;
}

export async function markConversationRead(db: Db, conversationId: string) {
  const [conversation] = await db
    .update(conversations)
    .set({ unreadCount: 0, updatedAt: new Date() })
    .where(eq(conversations.id, conversationId))
    .returning();

  return conversation;
}
