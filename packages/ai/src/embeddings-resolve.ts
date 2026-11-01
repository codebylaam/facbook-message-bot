import { DEFAULT_EMBEDDING_DIMENSIONS } from "./config.ts";
import { createEmbeddingsClient, type EmbeddingsClient } from "./embeddings.ts";
import {
  createWorkersAiEmbeddingsClient,
  DEFAULT_WORKERS_AI_MODEL,
} from "./embeddings-workers-ai.ts";
import type { FetchLike } from "./llm-types.ts";

export type EmbeddingsProviderConfig = {
  workersAi?: {
    accountId?: string;
    apiToken?: string;
    model?: string;
    dimensions?: number;
  };
  tei?: {
    baseUrl?: string;
  };
  fetchImpl?: FetchLike;
};

export function describeEmbeddingsProvider(config: EmbeddingsProviderConfig): string {
  if (config.workersAi?.accountId && config.workersAi.apiToken) {
    return `workers-ai:${config.workersAi.model ?? DEFAULT_WORKERS_AI_MODEL}`;
  }

  if (config.tei?.baseUrl) {
    return `tei:${config.tei.baseUrl}`;
  }

  return "none (text only retrieval)";
}

/**
 * Picks an embeddings provider, or null when none is configured. A null client is a
 * supported state: chunks are stored with no vector and search stays keyword-only.
 *
 * Workers AI wins over a self-hosted server so a stale EMBED_URL cannot quietly
 * pull traffic back to a machine that is no longer running.
 */
export function resolveEmbeddingsClient(config: EmbeddingsProviderConfig): EmbeddingsClient | null {
  const workersAi = config.workersAi;

  if (workersAi?.accountId && workersAi.apiToken) {
    return createWorkersAiEmbeddingsClient(
      {
        accountId: workersAi.accountId,
        apiToken: workersAi.apiToken,
        model: workersAi.model ?? DEFAULT_WORKERS_AI_MODEL,
        dimensions: workersAi.dimensions ?? DEFAULT_EMBEDDING_DIMENSIONS,
      },
      config.fetchImpl,
    );
  }

  if (config.tei?.baseUrl) {
    return createEmbeddingsClient({ baseUrl: config.tei.baseUrl }, config.fetchImpl);
  }

  return null;
}
