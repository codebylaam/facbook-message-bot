import type { LeadDraft, ReplyDecision, ReplyOutput } from "./types.ts";

export function handoffDecision(reason: string, draft = ""): ReplyDecision {
  return { action: "handoff", reason, draft };
}

/**
 * A lead is only worth a human's attention once there is some way to reach the
 * customer. Items on their own mean the bot is still collecting details.
 */
function isActionable(lead: LeadDraft): boolean {
  return Boolean(lead.phone?.trim() || lead.address?.trim());
}

export function decideReply(input: { output: ReplyOutput; threshold: number }): ReplyDecision {
  const { output, threshold } = input;
  const draft = output.reply;

  if (output.lead && isActionable(output.lead)) {
    return handoffDecision("The customer is placing an order, which a human must confirm", draft);
  }

  if (output.needsHuman) {
    return handoffDecision(
      output.handoffReason ?? "The model could not answer from the shop's knowledge",
      draft,
    );
  }

  if (output.confidence < threshold) {
    return handoffDecision(
      `Confidence ${output.confidence.toFixed(2)} is below the threshold ${threshold}`,
      draft,
    );
  }

  if (draft.trim().length === 0) {
    return handoffDecision("The model returned an empty reply", draft);
  }

  return { action: "send", reply: draft };
}
