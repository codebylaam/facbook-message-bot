import type { GraphApi } from "./graph.ts";

export type SenderAction = "mark_seen" | "typing_on" | "typing_off";

export type SendTextInput = {
  pageId: string;
  pageAccessToken: string;
  recipientId: string;
  text: string;
};

export type SendResult = {
  messageId: string | null;
  recipientId: string;
};

type SendResponse = {
  message_id?: string;
  recipient_id?: string;
};

export async function sendTextMessage(
  graphApi: GraphApi,
  input: SendTextInput,
): Promise<SendResult> {
  const response = await graphApi.request<SendResponse>(`/${input.pageId}/messages`, {
    method: "POST",
    accessToken: input.pageAccessToken,
    body: {
      messaging_type: "RESPONSE",
      recipient: { id: input.recipientId },
      message: { text: input.text },
    },
  });

  return {
    messageId: response.message_id ?? null,
    recipientId: response.recipient_id ?? input.recipientId,
  };
}

export async function sendSenderAction(
  graphApi: GraphApi,
  input: {
    pageId: string;
    pageAccessToken: string;
    recipientId: string;
    action: SenderAction;
  },
): Promise<void> {
  await graphApi.request(`/${input.pageId}/messages`, {
    method: "POST",
    accessToken: input.pageAccessToken,
    body: {
      recipient: { id: input.recipientId },
      sender_action: input.action,
    },
  });
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Shows the seen tick and the typing bubble, then pauses like a person would. */
export async function showTypingThenWait(
  graphApi: GraphApi,
  input: { pageId: string; pageAccessToken: string; recipientId: string },
  options: { delayMs: number },
): Promise<void> {
  await sendSenderAction(graphApi, { ...input, action: "mark_seen" });
  await sendSenderAction(graphApi, { ...input, action: "typing_on" });

  await wait(Math.max(0, options.delayMs));

  await sendSenderAction(graphApi, { ...input, action: "typing_off" });
}

export const FACEBOOK_POST_URL =
  /https?:\/\/(?:www\.|m\.)?facebook\.com\/[^\s]*?\/(?:posts|videos|reel)\/[^\s]+/i;

export function extractSharedPostUrl(text: string | null): string | null {
  if (!text) {
    return null;
  }

  return text.match(FACEBOOK_POST_URL)?.[0] ?? null;
}
