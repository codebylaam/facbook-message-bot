import { parseJsonContent } from "../extraction.ts";
import type { LlmClient } from "../llm-types.ts";
import type { ReplyTurn } from "./types.ts";

export const SUMMARY_EVERY_MESSAGES = 20;

const SUMMARY_PROMPT = [
  "Summarise this customer conversation for a shop owner in at most three sentences.",
  "Keep names, products, prices, sizes and any delivery detail exact.",
  'Write in English. Return JSON only: {"summary": "..."}',
].join(" ");

export function shouldRefreshSummary(messageCount: number): boolean {
  return messageCount > 0 && messageCount % SUMMARY_EVERY_MESSAGES === 0;
}

export async function summarizeConversation(
  llm: LlmClient,
  input: { pageName: string; history: ReplyTurn[] },
): Promise<string> {
  const transcript = input.history.map((turn) => `${turn.role}: ${turn.text}`).join("\n");

  const completion = await llm.chat(
    [
      { role: "system", content: SUMMARY_PROMPT },
      { role: "user", content: `Shop: ${input.pageName}\n\n${transcript}` },
    ],
    { json: true, temperature: 0, maxTokens: 300 },
  );

  const parsed = parseJsonContent(completion.content) as { summary?: unknown };

  if (typeof parsed?.summary !== "string" || parsed.summary.trim().length === 0) {
    throw new Error("the summary model returned no summary");
  }

  return parsed.summary.trim();
}

export function buildSummaryInput(history: ReplyTurn[]): ReplyTurn[] {
  return history.slice(-40);
}
