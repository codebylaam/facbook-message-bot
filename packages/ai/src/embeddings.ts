import {
  DEFAULT_EMBEDDING_BATCH_SIZE,
  DEFAULT_EMBEDDING_DIMENSIONS,
  type EmbeddingsConfig,
} from "./config.ts";
import type { FetchLike } from "./llm-types.ts";

export class EmbeddingsError extends Error {
  readonly status: number | undefined;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "EmbeddingsError";
    this.status = status;
  }
}

export type EmbeddingsClient = {
  dimensions: number;
  embed(inputs: string[]): Promise<number[][]>;
  embedOne(input: string): Promise<number[]>;
};

type EmbedRequest = {
  inputs: string[];
  truncate: boolean;
  normalize: boolean;
};

export function createEmbeddingsClient(
  config: EmbeddingsConfig,
  fetchImpl: FetchLike = fetch,
): EmbeddingsClient {
  const dimensions = config.dimensions ?? DEFAULT_EMBEDDING_DIMENSIONS;
  const batchSize = config.batchSize ?? DEFAULT_EMBEDDING_BATCH_SIZE;
  const timeoutMs = config.timeoutMs ?? 60_000;
  const url = `${config.baseUrl.replace(/\/$/, "")}/embed`;

  async function send(inputs: string[]): Promise<number[][]> {
    const body: EmbedRequest = { inputs, truncate: true, normalize: true };

    const response = await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new EmbeddingsError(
        `Embeddings request failed with ${response.status}: ${detail.slice(0, 300)}`,
        response.status,
      );
    }

    const parsed = (await response.json()) as unknown;

    if (!Array.isArray(parsed) || parsed.length !== inputs.length) {
      throw new EmbeddingsError(
        `Embeddings service returned ${Array.isArray(parsed) ? parsed.length : "an invalid number of"} vectors for ${inputs.length} inputs`,
      );
    }

    return parsed.map((vector, index) => {
      if (!Array.isArray(vector) || vector.length !== dimensions) {
        throw new EmbeddingsError(
          `Embedding ${index} has ${Array.isArray(vector) ? vector.length : "no"} dimensions, expected ${dimensions}`,
        );
      }

      return vector as number[];
    });
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
        throw new EmbeddingsError("Embeddings service returned no vector");
      }

      return vector;
    },
  };
}

export async function pingEmbeddings(
  config: EmbeddingsConfig,
  fetchImpl: FetchLike = fetch,
): Promise<boolean> {
  const response = await fetchImpl(`${config.baseUrl.replace(/\/$/, "")}/health`, {
    signal: AbortSignal.timeout(config.timeoutMs ?? 5_000),
  });

  return response.ok;
}
