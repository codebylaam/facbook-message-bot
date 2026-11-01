import { z } from "zod";

export const discoverPagesSchema = z.object({
  accessToken: z.string().min(1, "A Facebook access token is required"),
});

export const connectPageSchema = z.object({
  accessToken: z.string().min(1, "A Facebook access token is required"),
  fbPageId: z.string().min(1, "Choose a Page to connect"),
});

export const updatePageSettingsSchema = z.object({
  botEnabled: z.boolean().optional(),
  commentMode: z.enum(["off", "private", "private_public"]).optional(),
  confidenceThreshold: z.number().min(0).max(1).optional(),
  persona: z
    .object({
      name: z.string().max(80).optional(),
      tone: z.string().max(200).optional(),
      sampleReplies: z.array(z.string().max(500)).max(10).optional(),
    })
    .nullable()
    .optional(),
});

export type DiscoverPagesInput = z.infer<typeof discoverPagesSchema>;
export type ConnectPageInput = z.infer<typeof connectPageSchema>;
export type UpdatePageSettingsInput = z.infer<typeof updatePageSettingsSchema>;

export const discoveredPageSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string().optional(),
  tasks: z.array(z.string()),
});

export const connectedPageSchema = z.object({
  id: z.string(),
  fbPageId: z.string(),
  name: z.string(),
  botEnabled: z.boolean(),
  webhookStatus: z.enum(["pending", "active", "error"]),
  commentMode: z.enum(["off", "private", "private_public"]),
  confidenceThreshold: z.number(),
  lastSyncedAt: z.string().nullable(),
  createdAt: z.string(),
});

export const loginConfigSchema = z.object({
  appId: z.string(),
  graphVersion: z.string(),
  scopes: z.array(z.string()),
});

export const commentSchema = z.object({
  id: z.string(),
  pageId: z.string(),
  fbCommentId: z.string(),
  postId: z.string().nullable(),
  customerId: z.string().nullable(),
  customerName: z.string().nullable(),
  text: z.string().nullable(),
  classification: z.string().nullable(),
  replyStatus: z.enum(["pending", "private_replied", "public_replied", "flagged", "ignored"]),
  privateReplyMid: z.string().nullable(),
  publicReplyMid: z.string().nullable(),
  createdAt: z.string(),
});

export type DiscoveredPage = z.infer<typeof discoveredPageSchema>;
export type ConnectedPage = z.infer<typeof connectedPageSchema>;
export type LoginConfig = z.infer<typeof loginConfigSchema>;
export type Comment = z.infer<typeof commentSchema>;
