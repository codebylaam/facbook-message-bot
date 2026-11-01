import { parseJsonContent } from "../extraction.ts";
import type { ChatUsage, LlmClient } from "../llm-types.ts";
import { buildReplyMessages } from "./prompt.ts";
import { replyOutputSchema, toReplyOutput } from "./schema.ts";
import type {
  CustomerLanguage,
  ReplyKnowledge,
  ReplyOutput,
  ReplyTurn,
  RetrievedChunk,
} from "./types.ts";

export class ReplyGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReplyGenerationError";
  }
}

export type GenerateReplyInput = {
  knowledge: ReplyKnowledge;
  retrieved: RetrievedChunk[];
  summary: string | null;
  history: ReplyTurn[];
  message: string;
  language: CustomerLanguage;
};

export async function generateReply(
  llm: LlmClient,
  input: GenerateReplyInput,
): Promise<{ output: ReplyOutput; usage: ChatUsage }> {
  const completion = await llm.chat(buildReplyMessages(input), {
    json: true,
    temperature: 0.3,
    maxTokens: 600,
  });

  let parsed: unknown;

  try {
    parsed = parseJsonContent(completion.content);
  } catch {
    throw new ReplyGenerationError("The model did not return valid JSON");
  }

  const validated = replyOutputSchema.safeParse(parsed);

  if (!validated.success) {
    throw new ReplyGenerationError(
      `The model returned an unexpected shape: ${validated.error.issues[0]?.message ?? "unknown"}`,
    );
  }

  return { output: toReplyOutput(validated.data), usage: completion.usage };
}
