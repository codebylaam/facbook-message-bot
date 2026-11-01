import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

export const SIGNATURE_HEADER = "x-hub-signature-256";

export function computeSignature(rawBody: string | Buffer, appSecret: string): string {
  return `sha256=${createHmac("sha256", appSecret).update(rawBody).digest("hex")}`;
}

export function verifySignature(options: {
  rawBody: string;
  appSecret: string;
  signature: string | undefined;
}): boolean {
  const { signature } = options;

  if (!signature) {
    return false;
  }

  const expected = Buffer.from(computeSignature(options.rawBody, options.appSecret));
  const received = Buffer.from(signature);

  if (expected.length !== received.length) {
    return false;
  }

  return timingSafeEqual(expected, received);
}

const attachmentSchema = z.object({
  type: z.string(),
  payload: z
    .object({
      url: z.string().optional(),
      sticker_id: z.number().optional(),
    })
    .loose()
    .optional(),
});

const messagingEventSchema = z.object({
  sender: z.object({ id: z.string() }),
  recipient: z.object({ id: z.string() }),
  timestamp: z.number().optional(),
  message: z
    .object({
      mid: z.string().optional(),
      text: z.string().optional(),
      is_echo: z.boolean().optional(),
      attachments: z.array(attachmentSchema).optional(),
    })
    .loose()
    .optional(),
  postback: z
    .object({
      title: z.string().optional(),
      payload: z.string().optional(),
    })
    .loose()
    .optional(),
});

const feedChangeSchema = z.object({
  field: z.string(),
  value: z
    .object({
      item: z.string().optional(),
      verb: z.string().optional(),
      comment_id: z.string().optional(),
      post_id: z.string().optional(),
      parent_id: z.string().optional(),
      from: z
        .object({
          id: z.string().optional(),
          name: z.string().optional(),
        })
        .loose()
        .optional(),
      message: z.string().optional(),
      created_time: z.number().optional(),
    })
    .loose(),
});

export const webhookEntrySchema = z
  .object({
    id: z.string(),
    time: z.number().optional(),
    messaging: z.array(messagingEventSchema).optional(),
    changes: z.array(feedChangeSchema).optional(),
  })
  .loose();

export const webhookPayloadSchema = z
  .object({
    object: z.string(),
    entry: z.array(webhookEntrySchema),
  })
  .loose();

export type WebhookEntry = z.infer<typeof webhookEntrySchema>;
export type WebhookPayload = z.infer<typeof webhookPayloadSchema>;

export type WebhookField = "messages" | "feed" | "unknown";

export type ParsedWebhookEntry = {
  fbPageId: string;
  object: string;
  field: WebhookField;
  entry: WebhookEntry;
};

export function classifyEntry(entry: WebhookEntry): WebhookField {
  if (entry.messaging && entry.messaging.length > 0) {
    return "messages";
  }

  if (entry.changes?.some((change) => change.field === "feed")) {
    return "feed";
  }

  return "unknown";
}

export function parseWebhookPayload(rawBody: string): ParsedWebhookEntry[] {
  const parsed = webhookPayloadSchema.parse(JSON.parse(rawBody));

  return parsed.entry.map((entry) => ({
    fbPageId: entry.id,
    object: parsed.object,
    field: classifyEntry(entry),
    entry,
  }));
}
