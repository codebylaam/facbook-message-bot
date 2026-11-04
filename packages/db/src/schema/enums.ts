import { pgEnum } from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["seller", "admin"]);

export const conversationModeEnum = pgEnum("conversation_mode", ["bot", "human", "paused"]);
export const conversationStatusEnum = pgEnum("conversation_status", ["open", "closed"]);

export const messageDirectionEnum = pgEnum("message_direction", ["inbound", "outbound"]);
export const messageSenderEnum = pgEnum("message_sender", ["customer", "bot", "human"]);

export const commentModeEnum = pgEnum("comment_mode", ["off", "private", "private_public"]);
export const commentReplyStatusEnum = pgEnum("comment_reply_status", [
  "pending",
  "private_replied",
  "public_replied",
  "flagged",
  "ignored",
]);

export const productSourceEnum = pgEnum("product_source", ["manual", "extracted"]);
export const productStatusEnum = pgEnum("product_status", ["draft", "active"]);
export const stockStatusEnum = pgEnum("stock_status", [
  "in_stock",
  "out_of_stock",
  "preorder",
  "unknown",
]);

export const knowledgeSourceEnum = pgEnum("knowledge_source", [
  "page_profile",
  "post",
  "product",
  "faq",
  "policy",
  "document",
]);

export const leadStatusEnum = pgEnum("lead_status", ["new", "contacted", "won", "lost"]);
export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "active",
  "expired",
  "canceled",
]);
export const webhookStatusEnum = pgEnum("webhook_status", ["pending", "active", "error"]);

export const webhookFieldEnum = pgEnum("webhook_field", ["messages", "feed", "unknown"]);
export const webhookEventStatusEnum = pgEnum("webhook_event_status", [
  "received",
  "processed",
  "failed",
  "ignored",
]);
