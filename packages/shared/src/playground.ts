import { z } from "zod";

export const playgroundHistoryTurnSchema = z.object({
  role: z.enum(["customer", "bot", "human"]),
  text: z.string().max(4000),
});

export const playgroundRequestSchema = z.object({
  message: z.string().min(1, "Type a message to test").max(2000),
  history: z.array(playgroundHistoryTurnSchema).max(50).optional(),
});

export type PlaygroundRequest = z.infer<typeof playgroundRequestSchema>;

export const playgroundSourceSchema = z.object({
  id: z.string(),
  sourceType: z.string(),
  content: z.string(),
  score: z.number(),
});

export const playgroundResponseSchema = z.object({
  rewrite: z.object({
    query: z.string(),
    intent: z.string(),
    language: z.string(),
  }),
  retrieved: z.array(playgroundSourceSchema),
  decision: z.object({
    action: z.enum(["send", "handoff"]),
    reply: z.string().optional(),
    reason: z.string().optional(),
    draft: z.string().optional(),
  }),
  output: z
    .object({
      reply: z.string(),
      confidence: z.number(),
      needsHuman: z.boolean(),
      intent: z.string(),
      handoffReason: z.string().nullable(),
    })
    .nullable(),
  generationError: z.string().nullable(),
  embeddingsUsed: z.boolean(),
});

export type PlaygroundResponse = z.infer<typeof playgroundResponseSchema>;
export type PlaygroundSource = z.infer<typeof playgroundSourceSchema>;
