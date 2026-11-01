import type { ChatResult, LlmClient } from "../llm-types.ts";
import { catalogChunks } from "./golden.ts";

/**
 * A deliberately naive provider used by `bun run eval --dry`.
 *
 * It hands the top catalog entry back as the reply with middling confidence, which
 * is roughly what a retrieval-only bot would do. It exists to prove the harness
 * runs and to give a floor the real model has to beat, not to stand in for one.
 */
export function createBaselineLlm(): LlmClient {
  const chunks = catalogChunks();

  return {
    chat: async (messages): Promise<ChatResult> => {
      const prompt = messages.map((message) => message.content).join("\n");

      if (prompt.includes("search query")) {
        const question = messages.at(-1)?.content.split("\n")[0] ?? "";
        return {
          content: JSON.stringify({ query: question, intent: "other", language: "en" }),
          model: "baseline",
          usage: { promptTokens: 20, completionTokens: 10, totalTokens: 30 },
        };
      }

      const first = chunks[0];

      return {
        content: JSON.stringify({
          reply: first?.content ?? "",
          confidence: 0.5,
          needs_human: false,
          handoff_reason: null,
          intent: "other",
          source_ids: first ? [first.id] : [],
          lead: null,
        }),
        model: "baseline",
        usage: { promptTokens: 200, completionTokens: 60, totalTokens: 260 },
      };
    },
  };
}
