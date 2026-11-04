import { z } from "zod";

export const dashboardSchema = z.object({
  pageId: z.string().nullable(),
  conversations: z.number(),
  inHumanMode: z.number(),
  inboundMessages: z.number(),
  botMessages: z.number(),
  humanMessages: z.number(),
  leads: z.number(),
  draftProducts: z.number(),
  autoReplyRate: z.number(),
  usage: z.object({ used: z.number(), limit: z.number() }),
});

export const leadSchema = z.object({
  id: z.string(),
  pageId: z.string(),
  conversationId: z.string().nullable(),
  customerName: z.string().nullable(),
  customerPsid: z.string().nullable(),
  name: z.string().nullable(),
  phone: z.string().nullable(),
  address: z.string().nullable(),
  items: z.array(
    z.object({
      name: z.string(),
      quantity: z.number().nullable().optional(),
      variant: z.string().nullable().optional(),
    }),
  ),
  status: z.string(),
  note: z.string().nullable(),
  createdAt: z.string(),
});

export type Dashboard = z.infer<typeof dashboardSchema>;
export type Lead = z.infer<typeof leadSchema>;
