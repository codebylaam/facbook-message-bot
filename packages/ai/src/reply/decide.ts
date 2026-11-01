import type { ReplyDecision, ReplyOutput } from "./types.ts";

export function handoffDecision(reason: string, draft = ""): ReplyDecision {
  return { action: "handoff", reason, draft };
}

export function decideReply(input: { output: ReplyOutput; threshold: number }): ReplyDecision {
  const { output, threshold } = input;
  const draft = output.reply;

  if (output.lead) {
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
