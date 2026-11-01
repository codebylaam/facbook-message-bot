import type { ConversationMode } from "@fb-bot/db";

export const REPLY_WINDOW_HOURS = 24;
export const ECHO_HUMAN_MODE_HOURS = 4;

export type GuardInput = {
  botEnabled: boolean;
  mode: ConversationMode;
  lastCustomerMessageAt: Date | null;
  aiRepliesUsed: number;
  aiRepliesLimit: number;
  now?: Date;
};

export type GuardResult =
  | { allowed: true }
  | {
      allowed: false;
      reason: "bot_disabled" | "not_bot_mode" | "quota_exhausted" | "outside_window";
      message: string;
    };

export function windowExpiresAt(lastCustomerMessageAt: Date | null): Date | null {
  if (!lastCustomerMessageAt) {
    return null;
  }

  return new Date(lastCustomerMessageAt.getTime() + REPLY_WINDOW_HOURS * 60 * 60 * 1000);
}

export function isInsideReplyWindow(lastCustomerMessageAt: Date | null, now = new Date()): boolean {
  if (!lastCustomerMessageAt) {
    return false;
  }

  return now.getTime() <= (windowExpiresAt(lastCustomerMessageAt)?.getTime() ?? 0);
}

export function evaluateGuards(input: GuardInput): GuardResult {
  const now = input.now ?? new Date();

  if (!input.botEnabled) {
    return {
      allowed: false,
      reason: "bot_disabled",
      message: "The bot is turned off for this Page",
    };
  }

  if (input.mode !== "bot") {
    return {
      allowed: false,
      reason: "not_bot_mode",
      message: `The conversation is in ${input.mode} mode, so the bot stays quiet`,
    };
  }

  if (input.aiRepliesUsed >= input.aiRepliesLimit) {
    return {
      allowed: false,
      reason: "quota_exhausted",
      message: `The plan allows ${input.aiRepliesLimit} AI replies this month and all of them are used`,
    };
  }

  if (!isInsideReplyWindow(input.lastCustomerMessageAt, now)) {
    return {
      allowed: false,
      reason: "outside_window",
      message:
        "The customer's last message is older than 24 hours, so Messenger does not allow a reply",
    };
  }

  return { allowed: true };
}

export function echoHumanModeUntil(now = new Date()): Date {
  return new Date(now.getTime() + ECHO_HUMAN_MODE_HOURS * 60 * 60 * 1000);
}

export function shouldSwitchToHumanForEcho(mode: ConversationMode): boolean {
  return mode === "bot";
}
