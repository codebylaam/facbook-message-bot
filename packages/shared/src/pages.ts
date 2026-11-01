import { z } from "zod";

export const discoverPagesSchema = z.object({
  accessToken: z.string().min(1, "A Facebook access token is required"),
});

export const connectPageSchema = z.object({
  accessToken: z.string().min(1, "A Facebook access token is required"),
  fbPageId: z.string().min(1, "Choose a Page to connect"),
});

export type DiscoverPagesInput = z.infer<typeof discoverPagesSchema>;
export type ConnectPageInput = z.infer<typeof connectPageSchema>;

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

export type DiscoveredPage = z.infer<typeof discoveredPageSchema>;
export type ConnectedPage = z.infer<typeof connectedPageSchema>;
export type LoginConfig = z.infer<typeof loginConfigSchema>;
