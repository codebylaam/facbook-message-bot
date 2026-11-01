import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
  vector,
} from "drizzle-orm/pg-core";
import { timestamps, tsvector } from "./columns.ts";
import {
  knowledgeSourceEnum,
  productSourceEnum,
  productStatusEnum,
  stockStatusEnum,
} from "./enums.ts";
import { fbPages } from "./pages.ts";
import type { ProductVariants } from "./types.ts";

export const posts = pgTable(
  "posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pageId: uuid("page_id")
      .notNull()
      .references(() => fbPages.id, { onDelete: "cascade" }),
    fbPostId: text("fb_post_id").notNull().unique(),
    message: text("message"),
    permalink: text("permalink"),
    images: jsonb("images").$type<string[]>().notNull().default([]),
    included: boolean("included").notNull().default(true),
    fbCreatedTime: timestamp("fb_created_time", { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [index("posts_page_id_idx").on(t.pageId)],
);

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pageId: uuid("page_id")
      .notNull()
      .references(() => fbPages.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    price: numeric("price", { precision: 12, scale: 2 }),
    salePrice: numeric("sale_price", { precision: 12, scale: 2 }),
    currency: text("currency").notNull().default("BDT"),
    stockStatus: stockStatusEnum("stock_status").notNull().default("unknown"),
    variants: jsonb("variants")
      .$type<ProductVariants>()
      .notNull()
      .default(sql`'{"sizes": [], "colors": []}'::jsonb`),
    images: jsonb("images").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    source: productSourceEnum("source").notNull().default("manual"),
    status: productStatusEnum("status").notNull().default("draft"),
    postId: uuid("post_id").references(() => posts.id, { onDelete: "set null" }),
    ...timestamps(),
  },
  (t) => [index("products_page_id_idx").on(t.pageId), index("products_status_idx").on(t.status)],
);

export const faqs = pgTable(
  "faqs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pageId: uuid("page_id")
      .notNull()
      .references(() => fbPages.id, { onDelete: "cascade" }),
    question: text("question").notNull(),
    answer: text("answer").notNull(),
    ...timestamps(),
  },
  (t) => [index("faqs_page_id_idx").on(t.pageId)],
);

export const policies = pgTable(
  "policies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pageId: uuid("page_id")
      .notNull()
      .references(() => fbPages.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    content: text("content").notNull(),
    ...timestamps(),
  },
  (t) => [index("policies_page_id_idx").on(t.pageId)],
);

export const knowledgeChunks = pgTable(
  "knowledge_chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pageId: uuid("page_id")
      .notNull()
      .references(() => fbPages.id, { onDelete: "cascade" }),
    sourceType: knowledgeSourceEnum("source_type").notNull(),
    sourceId: uuid("source_id"),
    content: text("content").notNull(),
    embedding: vector("embedding", { dimensions: 1024 }),
    tsv: tsvector("tsv").generatedAlwaysAs(sql`to_tsvector('simple'::regconfig, content)`),
    ...timestamps(),
  },
  (t) => [
    index("knowledge_chunks_page_id_idx").on(t.pageId),
    index("knowledge_chunks_embedding_idx").using("hnsw", t.embedding.op("vector_cosine_ops")),
    index("knowledge_chunks_tsv_idx").using("gin", t.tsv),
    index("knowledge_chunks_content_trgm_idx").using("gin", t.content.op("gin_trgm_ops")),
  ],
);
