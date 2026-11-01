import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { timestamps } from "./columns.ts";
import {
  commentReplyStatusEnum,
  conversationModeEnum,
  conversationStatusEnum,
  leadStatusEnum,
  messageDirectionEnum,
  messageSenderEnum,
} from "./enums.ts";
import { posts } from "./knowledge.ts";
import { fbPages } from "./pages.ts";
import type { Attachment, LeadItem, MessageAiMetadata } from "./types.ts";

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pageId: uuid("page_id")
      .notNull()
      .references(() => fbPages.id, { onDelete: "cascade" }),
    psid: text("psid").notNull(),
    name: text("name"),
    profile: jsonb("profile").$type<Record<string, unknown>>(),
    ...timestamps(),
  },
  (t) => [uniqueIndex("customers_page_psid_idx").on(t.pageId, t.psid)],
);

export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pageId: uuid("page_id")
      .notNull()
      .references(() => fbPages.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    mode: conversationModeEnum("mode").notNull().default("bot"),
    status: conversationStatusEnum("status").notNull().default("open"),
    handoffReason: text("handoff_reason"),
    lastCustomerMsgAt: timestamp("last_customer_msg_at", { withTimezone: true }),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
    unreadCount: integer("unread_count").notNull().default(0),
    messageCount: integer("message_count").notNull().default(0),
    summary: text("summary"),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("conversations_page_customer_idx").on(t.pageId, t.customerId),
    index("conversations_mode_idx").on(t.mode),
    index("conversations_last_message_at_idx").on(t.lastMessageAt),
  ],
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    mid: text("mid").unique(),
    direction: messageDirectionEnum("direction").notNull(),
    sender: messageSenderEnum("sender").notNull(),
    text: text("text"),
    attachments: jsonb("attachments").$type<Attachment[]>().notNull().default([]),
    aiMetadata: jsonb("ai_metadata").$type<MessageAiMetadata>(),
    isEcho: boolean("is_echo").notNull().default(false),
    isDraft: boolean("is_draft").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("messages_conversation_id_idx").on(t.conversationId),
    index("messages_created_at_idx").on(t.createdAt),
  ],
);

export const comments = pgTable(
  "comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pageId: uuid("page_id")
      .notNull()
      .references(() => fbPages.id, { onDelete: "cascade" }),
    fbCommentId: text("fb_comment_id").notNull().unique(),
    postId: uuid("post_id").references(() => posts.id, { onDelete: "set null" }),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    text: text("text"),
    classification: text("classification"),
    replyStatus: commentReplyStatusEnum("reply_status").notNull().default("pending"),
    privateReplyMid: text("private_reply_mid"),
    publicReplyMid: text("public_reply_mid"),
    ...timestamps(),
  },
  (t) => [index("comments_page_id_idx").on(t.pageId), index("comments_post_id_idx").on(t.postId)],
);

export const leads = pgTable(
  "leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pageId: uuid("page_id")
      .notNull()
      .references(() => fbPages.id, { onDelete: "cascade" }),
    conversationId: uuid("conversation_id").references(() => conversations.id, {
      onDelete: "set null",
    }),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    name: text("name"),
    phone: text("phone"),
    address: text("address"),
    items: jsonb("items").$type<LeadItem[]>().notNull().default([]),
    status: leadStatusEnum("status").notNull().default("new"),
    note: text("note"),
    ...timestamps(),
  },
  (t) => [index("leads_page_id_idx").on(t.pageId)],
);
