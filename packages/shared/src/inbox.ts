import { z } from "zod";

export const conversationFilterSchema = z.enum(["all", "needs_attention", "bot", "human"]);

export type ConversationFilter = z.infer<typeof conversationFilterSchema>;

export const conversationSchema = z.object({
  id: z.string(),
  pageId: z.string(),
  customerId: z.string(),
  customerName: z.string().nullable(),
  customerPsid: z.string(),
  mode: z.enum(["bot", "human", "paused"]),
  status: z.enum(["open", "closed"]),
  handoffReason: z.string().nullable(),
  lastMessageText: z.string().nullable(),
  lastMessageAt: z.string().nullable(),
  lastCustomerMsgAt: z.string().nullable(),
  unreadCount: z.number(),
  messageCount: z.number(),
  summary: z.string().nullable(),
  hasDraft: z.boolean(),
});

export const inboxMessageSchema = z.object({
  id: z.string(),
  direction: z.enum(["inbound", "outbound"]),
  sender: z.enum(["customer", "bot", "human"]),
  text: z.string().nullable(),
  isDraft: z.boolean(),
  isEcho: z.boolean(),
  confidence: z.number().nullable(),
  intent: z.string().nullable(),
  createdAt: z.string(),
});

export const sendMessageSchema = z.object({
  text: z.string().min(1, "Type a reply").max(2000),
});

export const updateDraftSchema = z.object({
  text: z.string().min(1, "A draft cannot be empty").max(2000),
});

export type Conversation = z.infer<typeof conversationSchema>;
export type InboxMessage = z.infer<typeof inboxMessageSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type UpdateDraftInput = z.infer<typeof updateDraftSchema>;

export const inboxEventSchema = z.object({
  conversationId: z.string(),
  pageId: z.string(),
  kind: z.enum(["handoff", "draft", "sent", "lead"]),
  reason: z.string().nullable().optional(),
});

export type InboxEvent = z.infer<typeof inboxEventSchema>;
