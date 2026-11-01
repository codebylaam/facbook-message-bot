import { boolean, index, jsonb, pgTable, real, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth.ts";
import { timestamps } from "./columns.ts";
import { commentModeEnum, webhookStatusEnum } from "./enums.ts";
import type { HandoffRules, Persona } from "./types.ts";

export const fbPages = pgTable(
  "fb_pages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    fbPageId: text("fb_page_id").notNull().unique(),
    name: text("name").notNull(),
    accessTokenEncrypted: text("access_token_encrypted").notNull(),
    webhookStatus: webhookStatusEnum("webhook_status").notNull().default("pending"),
    botEnabled: boolean("bot_enabled").notNull().default(true),
    persona: jsonb("persona").$type<Persona>(),
    confidenceThreshold: real("confidence_threshold").notNull().default(0.7),
    commentMode: commentModeEnum("comment_mode").notNull().default("private_public"),
    handoffRules: jsonb("handoff_rules").$type<HandoffRules>(),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [index("fb_pages_owner_id_idx").on(t.ownerId)],
);

export const pageProfile = pgTable("page_profile", {
  id: uuid("id").primaryKey().defaultRandom(),
  pageId: uuid("page_id")
    .notNull()
    .unique()
    .references(() => fbPages.id, { onDelete: "cascade" }),
  about: text("about"),
  description: text("description"),
  phone: text("phone"),
  address: text("address"),
  website: text("website"),
  emails: jsonb("emails").$type<string[]>(),
  hours: jsonb("hours").$type<Record<string, string>>(),
  ...timestamps(),
});
