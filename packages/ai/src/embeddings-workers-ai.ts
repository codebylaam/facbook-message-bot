import { DEFAULT_EMBEDDING_BATCH_SIZE, DEFAULT_EMBEDDING_DIMENSIONS } from "./config.ts";
import { type EmbeddingsClient, EmbeddingsError } from "./embeddings.ts";
import type { FetchLike } from "./llm-types.ts";

export const DEFAULT_WORKERS_AI_MODEL = "@cf/baai/bge-m3";
export const DEFAULT_WORKERS_AI_BASE_URL = "https://api.cloudflare.com/client/v4";

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const DEFAULT_MAX_RETRIES = 4;
const DEFAULT_RETRY_DELAY_MS = 800;

export type WorkersAiEmbeddingsConfig = {
  accountId: string;
  apiToken: string;
  model?: string;
  dimensions?: number;
  batchSize?: number;
  timeoutMs?: number;
  maxRetries?: number;
  retryDelayMs?: number;
  baseUrl?: string;
};

type WorkersAiResponse = {
  result?: { shape?: number[]; data?: number[][] } | null;
  success?: boolean;
  errors?: { code?: number; message?: string }[];
};

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryAfterMs(response: Response): number | undefined {
  const seconds = Number(response.headers.get("retry-after"));

  return Number.isFinite(seconds) ? Math.max(0, seconds * 1000) : undefined;
}

export function createWorkersAiEmbeddingsClient(
  config: WorkersAiEmbeddingsConfig,
  fetchImpl: FetchLike = fetch,
): EmbeddingsClient {
  const dimensions = config.dimensions ?? DEFAULT_EMBEDDING_DIMENSIONS;
  const batchSize = config.batchSize ?? DEFAULT_EMBEDDING_BATCH_SIZE;
  const timeoutMs = config.timeoutMs ?? 60_000;
  const maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;
  const retryDelay = config.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
  const baseUrl = config.baseUrl ?? DEFAULT_WORKERS_AI_BASE_URL;
  const model = config.model ?? DEFAULT_WORKERS_AI_MODEL;

  const url = `${baseUrl.replace(/\/$/, "")}/accounts/${config.accountId}/ai/run/${model}`;

  async function send(inputs: string[]): Promise<number[][]> {
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      let response: Response;

      try {
        response = await fetchImpl(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.apiToken}`,
          },
          signal: AbortSignal.timeout(timeoutMs),
          body: JSON.stringify({ text: inputs }),
        });
      } catch (error) {
        if (attempt === maxRetries) {
          throw new EmbeddingsError(
            `Workers AI embeddings request failed: ${error instanceof Error ? error.message : "network error"}`,
          );
        }

        await wait(retryDelay * 2 ** attempt);
        continue;
      }

      const payload = (await response.json().catch(() => null)) as WorkersAiResponse | null;

      if (!response.ok || payload?.success === false) {
        const message =
          payload?.errors?.[0]?.message ?? `Workers AI responded with ${response.status}`;

        if (!RETRYABLE_STATUS.has(response.status) || attempt === maxRetries) {
          throw new EmbeddingsError(`Workers AI embeddings failed: ${message}`, response.status);
        }

        await wait(retryAfterMs(response) ?? retryDelay * 2 ** attempt);
        continue;
      }

      const vectors = payload?.result?.data;

      if (!Array.isArray(vectors) || vectors.length !== inputs.length) {
        throw new EmbeddingsError(
          `Workers AI returned ${Array.isArray(vectors) ? vectors.length : "no"} vectors for ${inputs.length} inputs`,
        );
      }

      return vectors.map((vector, index) => {
        if (!Array.isArray(vector) || vector.length !== dimensions) {
          throw new EmbeddingsError(
            `Embedding ${index} has ${Array.isArray(vector) ? vector.length : "no"} dimensions, expected ${dimensions}`,
          );
        }

        return vector as number[];
      });
    }

    throw new EmbeddingsError("Workers AI embeddings failed");
  }

  return {
    dimensions,

    async embed(inputs) {
      const vectors: number[][] = [];

      for (let index = 0; index < inputs.length; index += batchSize) {
        vectors.push(...(await send(inputs.slice(index, index + batchSize))));
      }

      return vectors;
    },

    async embedOne(input) {
      const [vector] = await send([input]);

      if (!vector) {
        throw new EmbeddingsError("Workers AI returned no vector");
      }

      return vector;
    },
  };
}
