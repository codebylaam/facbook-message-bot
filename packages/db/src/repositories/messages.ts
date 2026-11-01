import { and, asc, eq } from "drizzle-orm";
import type { Db } from "../client.ts";
import { messages } from "../schema/conversations.ts";
import type { messageDirectionEnum, messageSenderEnum } from "../schema/enums.ts";
import type { Attachment, MessageAiMetadata } from "../schema/types.ts";

export type MessageDirection = (typeof messageDirectionEnum.enumValues)[number];
export type MessageSender = (typeof messageSenderEnum.enumValues)[number];

export type NewMessage = {
  conversationId: string;
  mid?: string | null;
  direction: MessageDirection;
  sender: MessageSender;
  text?: string | null;
  attachments?: Attachment[];
  aiMetadata?: MessageAiMetadata | null;
  isEcho?: boolean;
  isDraft?: boolean;
  createdAt?: Date;
};

export async function midExists(db: Db, mid: string) {
  const [row] = await db
    .select({ id: messages.id })
    .from(messages)
    .where(eq(messages.mid, mid))
    .limit(1);

  return row !== undefined;
}

export async function insertMessage(db: Db, input: NewMessage) {
  const [message] = await db
    .insert(messages)
    .values({
      conversationId: input.conversationId,
      mid: input.mid ?? null,
      direction: input.direction,
      sender: input.sender,
      text: input.text ?? null,
      attachments: input.attachments ?? [],
      aiMetadata: input.aiMetadata ?? null,
      isEcho: input.isEcho ?? false,
      isDraft: input.isDraft ?? false,
      createdAt: input.createdAt ?? new Date(),
    })
    .onConflictDoNothing({ target: messages.mid })
    .returning();

  return message;
}

export async function listMessagesForConversation(db: Db, conversationId: string, limit = 100) {
  const rows = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.createdAt))
    .limit(limit);

  return rows;
}

export async function listRecentMessages(db: Db, conversationId: string, limit = 10) {
  const rows = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.createdAt))
    .limit(limit);

  return rows;
}

export async function listPendingInboundMessages(db: Db, conversationId: string) {
  const rows = await listMessagesForConversation(db, conversationId, 100);

  let lastOutbound = -1;

  rows.forEach((row, index) => {
    if (row.direction === "outbound") {
      lastOutbound = index;
    }
  });

  return rows.slice(lastOutbound + 1).filter((row) => row.direction === "inbound");
}

export async function listDraftMessages(db: Db, conversationId: string) {
  return db
    .select()
    .from(messages)
    .where(and(eq(messages.conversationId, conversationId), eq(messages.isDraft, true)))
    .orderBy(asc(messages.createdAt));
}

export async function clearDrafts(db: Db, conversationId: string) {
  const cleared = await db
    .update(messages)
    .set({ isDraft: false })
    .where(and(eq(messages.conversationId, conversationId), eq(messages.isDraft, true)))
    .returning({ id: messages.id });

  return cleared.length;
}

export async function updateMessageText(db: Db, messageId: string, text: string) {
  const [message] = await db
    .update(messages)
    .set({ text })
    .where(eq(messages.id, messageId))
    .returning();

  return message;
}
