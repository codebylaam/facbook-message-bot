import {
  createLlmClient,
  type EmbeddingsClient,
  type LlmClient,
  resolveEmbeddingsClient,
} from "@fb-bot/ai";
import { createDb } from "@fb-bot/db";
import {
  createGraphApi,
  type GraphApi,
  type MetaConfig,
  PageRateLimiter,
  parseEncryptionKey,
} from "@fb-bot/meta";
import { env } from "./env.ts";

const { db, close } = createDb(env.DATABASE_URL);

export const metaConfig: MetaConfig = {
  appId: env.META_APP_ID,
  appSecret: env.META_APP_SECRET,
  verifyToken: env.META_VERIFY_TOKEN,
  graphVersion: env.META_GRAPH_VERSION,
};

export type WorkerDeps = {
  db: typeof db;
  graphApi: GraphApi;
  llm: LlmClient;
  /** Null means no embeddings provider is configured; chunks get no vector. */
  embeddings: EmbeddingsClient | null;
  /** Per Page sliding window against the Graph API budget. */
  rateLimiter: PageRateLimiter;
  encryptionKey: Buffer;
};

let encryptionKey: Buffer | undefined;

export function getEncryptionKey(): Buffer {
  if (!encryptionKey) {
    encryptionKey = parseEncryptionKey(env.TOKEN_ENC_KEY);
  }

  return encryptionKey;
}

export function createDeps(overrides: Partial<WorkerDeps> = {}): WorkerDeps {
  return {
    db,
    graphApi: createGraphApi(metaConfig),
    llm: createLlmClient({
      apiKey: env.CMD_API_KEY,
      baseUrl: env.CMD_BASE_URL,
      model: env.LLM_MODEL,
    }),
    embeddings: resolveEmbeddingsClient({
      workersAi: {
        accountId: env.CF_ACCOUNT_ID,
        apiToken: env.CF_API_TOKEN,
        model: env.CF_EMBED_MODEL,
      },
      tei: { baseUrl: env.EMBED_URL },
    }),
    rateLimiter: new PageRateLimiter({
      limit: env.GRAPH_CALLS_PER_HOUR,
      windowMs: 60 * 60 * 1000,
    }),
    encryptionKey: getEncryptionKey(),
    ...overrides,
  };
}

export { close as closeDb, db };
