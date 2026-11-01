import { parseJsonContent } from "../extraction.ts";
import type { LlmClient } from "../llm-types.ts";
import { queryRewriteSchema, type RawQueryRewrite } from "./schema.ts";
import type { CustomerLanguage, QueryRewrite, ReplyTurn } from "./types.ts";

const REWRITE_SYSTEM_PROMPT = [
  "You turn one customer message for a Bangladeshi online shop into a short search query",
  "for its knowledge base, written in both Bangla and English keywords.",
  'For example "ei shirt er dam koto, L size ache?" becomes "shirt price size L stock দাম".',
  "Also report the intent and the script the customer used.",
  "Return JSON only:",
  '{"query": "keywords", "intent": "pricing | product | stock | delivery | order | complaint | greeting | other", "language": "bn | banglish | en"}',
].join(" ");

const BANGLISH_HINTS =
  /\b(koto|dam|daam|ache|ase|achhe|kemon|kemun|ki|na|er|ta|hobe|korbo|kore|den|dio|plz|pls|kmn|kothay|kotay|tk|taka|size|choto|boro|kobe|kotha|bolen|lagbe|chan|chai|kemne)\b/i;

export function detectLanguage(text: string): CustomerLanguage {
  if (/[\u0980-\u09FF]/.test(text)) {
    return "bn";
  }

  if (BANGLISH_HINTS.test(text)) {
    return "banglish";
  }

  return "en";
}

export function fallbackRewrite(message: string): QueryRewrite {
  return { query: message, intent: "other", language: detectLanguage(message) };
}

export async function rewriteQuery(
  llm: LlmClient,
  input: { message: string; history?: ReplyTurn[] },
): Promise<QueryRewrite> {
  const history = (input.history ?? []).slice(-3);
  const context =
    history.length > 0
      ? `\n\nRecent messages:\n${history.map((turn) => `${turn.role}: ${turn.text}`).join("\n")}`
      : "";

  const completion = await llm.chat(
    [
      { role: "system", content: REWRITE_SYSTEM_PROMPT },
      { role: "user", content: `${input.message}${context}` },
    ],
    { json: true, temperature: 0, maxTokens: 200 },
  );

  const raw = queryRewriteSchema.parse(safeParse(completion.content));

  return {
    query: raw.query.trim().length > 0 ? raw.query.trim() : input.message,
    intent: raw.intent,
    language: raw.language,
  };
}

export async function rewriteQueryWithFallback(
  llm: LlmClient,
  input: { message: string; history?: ReplyTurn[] },
): Promise<QueryRewrite> {
  try {
    return await rewriteQuery(llm, input);
  } catch (error) {
    // A rewrite failure must not lose the customer's message: search with it verbatim.
    console.warn("[ai] query rewrite failed, searching with the raw message", error);
    return fallbackRewrite(input.message);
  }
}

function safeParse(content: string): RawQueryRewrite {
  return queryRewriteSchema.parse(parseJsonContent(content));
}
