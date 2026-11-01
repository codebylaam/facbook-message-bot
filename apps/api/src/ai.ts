import {
  createLlmClient,
  describeEmbeddingsProvider,
  type EmbeddingsClient,
  type LlmClient,
  resolveEmbeddingsClient,
} from "@fb-bot/ai";
import { env } from "./env.ts";

export const llm: LlmClient = createLlmClient({
  apiKey: env.CMD_API_KEY,
  baseUrl: env.CMD_BASE_URL,
  model: env.LLM_MODEL,
});

const embeddingsConfig = {
  workersAi: {
    accountId: env.CF_ACCOUNT_ID,
    apiToken: env.CF_API_TOKEN,
    model: env.CF_EMBED_MODEL,
  },
  tei: { baseUrl: env.EMBED_URL },
};

export const embeddings: EmbeddingsClient | null = resolveEmbeddingsClient(embeddingsConfig);

export const embeddingsProvider = describeEmbeddingsProvider(embeddingsConfig);
