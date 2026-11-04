import { z } from "zod";

export const productStatusSchema = z.enum(["draft", "active"]);
export const productSourceSchema = z.enum(["manual", "extracted"]);
export const stockStatusSchema = z.enum(["in_stock", "out_of_stock", "preorder", "unknown"]);

export const variantsSchema = z.object({
  sizes: z.array(z.string()).default([]),
  colors: z.array(z.string()).default([]),
});

export const productSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  price: z.string().nullable(),
  salePrice: z.string().nullable(),
  currency: z.string(),
  stockStatus: stockStatusSchema,
  variants: variantsSchema,
  images: z.array(z.string()),
  source: productSourceSchema,
  status: productStatusSchema,
  postId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const createProductSchema = z.object({
  name: z.string().min(1, "A product needs a name").max(200),
  description: z.string().max(4000).nullable().optional(),
  price: z.number().nonnegative().nullable().optional(),
  salePrice: z.number().nonnegative().nullable().optional(),
  stockStatus: stockStatusSchema.optional(),
  variants: variantsSchema.optional(),
  images: z.array(z.string()).optional(),
  status: productStatusSchema.optional(),
});

export const updateProductSchema = createProductSchema.partial();

export const faqSchema = z.object({
  id: z.string(),
  question: z.string(),
  answer: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const createFaqSchema = z.object({
  question: z.string().min(1, "A question is required").max(500),
  answer: z.string().min(1, "An answer is required").max(4000),
});

export const updateFaqSchema = createFaqSchema.partial();

export const policySchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const createPolicySchema = z.object({
  title: z.string().min(1, "A title is required").max(200),
  content: z.string().min(1, "Some content is required").max(8000),
});

export const updatePolicySchema = createPolicySchema.partial();

export const postSchema = z.object({
  id: z.string(),
  fbPostId: z.string(),
  message: z.string().nullable(),
  permalink: z.string().nullable(),
  images: z.array(z.string()),
  included: z.boolean(),
  fbCreatedTime: z.string().nullable(),
  createdAt: z.string(),
});

export const updatePostSchema = z.object({
  included: z.boolean(),
});

/**
 * What the Knowledge page lets a seller upload. The API accepts the same set, so
 * the picker and the validator cannot drift apart.
 */
export const DOCUMENT_EXTENSIONS = [".md", ".markdown", ".txt", ".csv"] as const;

export const DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;

/** The extracted text is deliberately not part of this: it can be long, and the
 * list view only needs to name the document. */
export const documentSchema = z.object({
  id: z.string(),
  name: z.string(),
  mimeType: z.string(),
  byteSize: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const knowledgeSummarySchema = z.object({
  pageId: z.string(),
  posts: z.number(),
  products: z.number(),
  draftProducts: z.number(),
  faqs: z.number(),
  policies: z.number(),
  documents: z.number(),
  chunks: z.number(),
  unembeddedChunks: z.number(),
  lastSyncedAt: z.string().nullable(),
});

export type Product = z.infer<typeof productSchema>;
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type Faq = z.infer<typeof faqSchema>;
export type CreateFaqInput = z.infer<typeof createFaqSchema>;
export type Policy = z.infer<typeof policySchema>;
export type CreatePolicyInput = z.infer<typeof createPolicySchema>;
export type Post = z.infer<typeof postSchema>;
export type Document = z.infer<typeof documentSchema>;
export type KnowledgeSummary = z.infer<typeof knowledgeSummarySchema>;
