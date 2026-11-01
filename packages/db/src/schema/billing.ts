import {
  date,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth.ts";
import { timestamps } from "./columns.ts";
import { subscriptionStatusEnum } from "./enums.ts";

export const plans = pgTable("plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  aiRepliesPerMonth: integer("ai_replies_per_month").notNull(),
  pageLimit: integer("page_limit").notNull().default(1),
  price: numeric("price", { precision: 12, scale: 2 }).notNull().default("0"),
  ...timestamps(),
});

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    planId: uuid("plan_id")
      .notNull()
      .references(() => plans.id, { onDelete: "restrict" }),
    status: subscriptionStatusEnum("status").notNull().default("active"),
    periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
    periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
    ...timestamps(),
  },
  (t) => [index("subscriptions_owner_id_idx").on(t.ownerId)],
);

export const usageCounters = pgTable(
  "usage_counters",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    periodStart: date("period_start").notNull(),
    aiReplies: integer("ai_replies").notNull().default(0),
    ...timestamps(),
  },
  (t) => [uniqueIndex("usage_counters_owner_period_idx").on(t.ownerId, t.periodStart)],
);
