import { z } from "zod";

export const planSchema = z.object({
  id: z.string(),
  name: z.string(),
  aiRepliesPerMonth: z.number(),
  pageLimit: z.number(),
  price: z.string(),
});

export const billingSummarySchema = z.object({
  hasPlan: z.boolean(),
  planName: z.string().nullable(),
  aiRepliesPerMonth: z.number(),
  pageLimit: z.number(),
  price: z.string().nullable(),
  status: z.string().nullable(),
  periodStart: z.string().nullable(),
  periodEnd: z.string().nullable(),
  used: z.number(),
  remaining: z.number(),
  paused: z.boolean(),
  pagesUsed: z.number(),
});

export const adminUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  role: z.string(),
  createdAt: z.string(),
  planName: z.string().nullable(),
  aiRepliesPerMonth: z.number().nullable(),
  subscriptionStatus: z.string().nullable(),
  periodEnd: z.string().nullable(),
  used: z.number(),
});

export const assignPlanSchema = z.object({
  planName: z.string().min(1, "Choose a plan"),
  months: z.number().int().min(1).max(24).default(1),
});

export const setRoleSchema = z.object({
  role: z.enum(["seller", "admin"]),
});

export type Plan = z.infer<typeof planSchema>;
export type BillingSummary = z.infer<typeof billingSummarySchema>;
export type AdminUser = z.infer<typeof adminUserSchema>;
export type AssignPlanInput = z.infer<typeof assignPlanSchema>;
export type SetRoleInput = z.infer<typeof setRoleSchema>;
