export type LlmConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
  timeoutMs?: number;
  maxRetries?: number;
  retryDelayMs?: number;
};

export type EmbeddingsConfig = {
  baseUrl: string;
  dimensions?: number;
  batchSize?: number;
  timeoutMs?: number;
};

export const DEFAULT_EMBEDDING_DIMENSIONS = 1024;
export const DEFAULT_EMBEDDING_BATCH_SIZE = 16;
