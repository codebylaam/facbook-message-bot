import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { webhookEventStatusEnum, webhookFieldEnum } from "./enums.ts";
import { fbPages } from "./pages.ts";

export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pageId: uuid("page_id").references(() => fbPages.id, { onDelete: "set null" }),
    fbPageId: text("fb_page_id").notNull(),
    object: text("object").notNull(),
    field: webhookFieldEnum("field").notNull().default("unknown"),
    raw: jsonb("raw").$type<unknown>().notNull(),
    status: webhookEventStatusEnum("status").notNull().default("received"),
    error: text("error"),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
  },
  (t) => [
    index("webhook_events_fb_page_id_idx").on(t.fbPageId),
    index("webhook_events_status_idx").on(t.status),
    index("webhook_events_received_at_idx").on(t.receivedAt),
  ],
);
