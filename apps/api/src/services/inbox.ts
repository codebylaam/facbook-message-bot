import {
  clearDrafts,
  type Db,
  findConversationById,
  findCustomerById,
  findInboxConversation,
  findPageById,
  insertMessage,
  listInboxConversations,
  listThreadMessages,
  markConversationRead,
  recordOutboundMessage,
  setConversationMode,
} from "@fb-bot/db";
import { decryptToken, type GraphApi, sendTextMessage } from "@fb-bot/meta";
import type { Conversation, InboxMessage } from "@fb-bot/shared";
import { PageConnectionError } from "./pages.ts";

export type InboxDeps = {
  db: Db;
  graphApi: GraphApi;
  encryptionKey: Buffer;
};

type ConversationRow = NonNullable<Awaited<ReturnType<typeof findInboxConversation>>>;
type MessageRow = Awaited<ReturnType<typeof listThreadMessages>>[number];

function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

export function toConversation(row: ConversationRow, hasDraft = false): Conversation {
  return {
    id: row.id,
    pageId: row.pageId,
    customerId: row.customerId,
    customerName: row.customerName,
    customerPsid: row.customerPsid,
    mode: row.mode,
    status: row.status,
    handoffReason: row.handoffReason,
    lastMessageText: null,
    lastMessageAt: iso(row.lastMessageAt),
    lastCustomerMsgAt: iso(row.lastCustomerMsgAt),
    unreadCount: row.unreadCount,
    messageCount: row.messageCount,
    summary: row.summary,
    hasDraft,
  };
}

export function toMessage(row: MessageRow): InboxMessage {
  return {
    id: row.id,
    direction: row.direction,
    sender: row.sender,
    text: row.text,
    isDraft: row.isDraft,
    isEcho: row.isEcho,
    confidence: row.aiMetadata?.confidence ?? null,
    intent: row.aiMetadata?.intent ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function loadConversation(deps: InboxDeps, pageId: string, conversationId: string) {
  const row = await findInboxConversation(deps.db, pageId, conversationId);

  if (!row) {
    throw new PageConnectionError("Conversation not found", 404);
  }

  const messages = await listThreadMessages(deps.db, conversationId);
  const hasDraft = messages.some((message) => message.isDraft);

  return { conversation: toConversation(row, hasDraft), messages: messages.map(toMessage) };
}

function pageToken(deps: InboxDeps, pageAccessTokenEncrypted: string): string {
  return decryptToken(pageAccessTokenEncrypted, deps.encryptionKey);
}

export async function sendHumanReply(
  deps: InboxDeps,
  input: { pageId: string; conversationId: string; text: string },
): Promise<InboxMessage> {
  const conversation = await findConversationById(deps.db, input.conversationId);

  if (!conversation || conversation.pageId !== input.pageId) {
    throw new PageConnectionError("Conversation not found", 404);
  }

  const page = await findPageById(deps.db, input.pageId);

  if (!page) {
    throw new PageConnectionError("Page not found", 404);
  }

  const customer = await findCustomerById(deps.db, conversation.customerId);

  if (!customer) {
    throw new PageConnectionError("Customer not found", 404);
  }

  const sent = await sendTextMessage(deps.graphApi, {
    pageId: page.fbPageId,
    pageAccessToken: pageToken(deps, page.accessTokenEncrypted),
    recipientId: customer.psid,
    text: input.text,
  });

  const message = await insertMessage(deps.db, {
    conversationId: conversation.id,
    mid: sent.messageId,
    direction: "outbound",
    sender: "human",
    text: input.text,
  });

  await recordOutboundMessage(deps.db, conversation.id);

  if (conversation.mode !== "human") {
    await setConversationMode(
      deps.db,
      conversation.id,
      "human",
      "The seller replied from the inbox",
    );
  }

  if (!message) {
    throw new PageConnectionError("Could not store the reply", 502);
  }

  return toMessage(message);
}

export async function approveDraft(
  deps: InboxDeps,
  input: { pageId: string; conversationId: string; draftId: string },
): Promise<InboxMessage> {
  const messages = await listThreadMessages(deps.db, input.conversationId);
  const draft = messages.find((message) => message.id === input.draftId);

  if (!draft?.isDraft) {
    throw new PageConnectionError("Draft not found", 404);
  }

  if (!draft.text) {
    throw new PageConnectionError("The draft has no text to send", 400);
  }

  const sent = await sendHumanReply(deps, {
    pageId: input.pageId,
    conversationId: input.conversationId,
    text: draft.text,
  });

  await clearDrafts(deps.db, input.conversationId);

  return sent;
}

export async function discardDraft(
  deps: InboxDeps,
  input: { pageId: string; conversationId: string },
): Promise<number> {
  const conversation = await findInboxConversation(deps.db, input.pageId, input.conversationId);

  if (!conversation) {
    throw new PageConnectionError("Conversation not found", 404);
  }

  return clearDrafts(deps.db, input.conversationId);
}

export async function setInboxMode(
  deps: InboxDeps,
  input: { pageId: string; conversationId: string; mode: "bot" | "human" },
) {
  const conversation = await findInboxConversation(deps.db, input.pageId, input.conversationId);

  if (!conversation) {
    throw new PageConnectionError("Conversation not found", 404);
  }

  return setConversationMode(deps.db, input.conversationId, input.mode);
}

export async function markInboxRead(
  deps: InboxDeps,
  input: { pageId: string; conversationId: string },
) {
  const conversation = await findInboxConversation(deps.db, input.pageId, input.conversationId);

  if (!conversation) {
    throw new PageConnectionError("Conversation not found", 404);
  }

  return markConversationRead(deps.db, input.conversationId);
}

export async function listInbox(
  deps: InboxDeps,
  pageId: string,
  filter: Parameters<typeof listInboxConversations>[2],
) {
  return listInboxConversations(deps.db, pageId, filter);
}
