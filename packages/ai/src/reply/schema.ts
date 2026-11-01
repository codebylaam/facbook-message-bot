import { z } from "zod";
import { INTENTS } from "./types.ts";

const nullableText = z
  .union([z.string(), z.null()])
  .catch(null)
  .transform((value) => {
    if (value === null) {
      return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  });

const leadSchema = z.object({
  name: nullableText,
  phone: nullableText,
  address: nullableText,
  items: z
    .array(
      z.object({
        name: z.string().min(1),
        quantity: z
          .number()
          .nullish()
          .catch(null)
          .transform((value) => value ?? null),
        variant: nullableText,
      }),
    )
    .catch([]),
});

// Every field falls back to the safe direction: an unreadable answer hands
// off to the seller rather than sending something the model made up.
export const replyOutputSchema = z.object({
  reply: z.string().catch(""),
  confidence: z.number().min(0).max(1).catch(0),
  needs_human: z.boolean().catch(true),
  handoff_reason: nullableText,
  intent: z.enum(INTENTS).catch("other"),
  source_ids: z.array(z.string()).catch([]),
  lead: leadSchema
    .nullish()
    .catch(null)
    .transform((value) => value ?? null),
});

export type RawReplyOutput = z.infer<typeof replyOutputSchema>;

export function toReplyOutput(raw: RawReplyOutput) {
  return {
    reply: raw.reply.trim(),
    confidence: raw.confidence,
    needsHuman: raw.needs_human,
    handoffReason: raw.handoff_reason,
    intent: raw.intent,
    sourceIds: raw.source_ids,
    lead:
      raw.lead && raw.lead.items.length > 0
        ? {
            name: raw.lead.name,
            phone: raw.lead.phone,
            address: raw.lead.address,
            items: raw.lead.items.map((item) => ({
              name: item.name,
              quantity: item.quantity ?? null,
              variant: item.variant,
            })),
          }
        : null,
  };
}

export const queryRewriteSchema = z.object({
  query: z.string().catch(""),
  intent: z.enum(INTENTS).catch("other"),
  language: z.enum(["bn", "banglish", "en"]).catch("en"),
});

export type RawQueryRewrite = z.infer<typeof queryRewriteSchema>;
