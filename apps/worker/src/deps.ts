import {
  createEmbeddingsClient,
  createLlmClient,
  type EmbeddingsClient,
  type LlmClient,
} from "@fb-bot/ai";
import { createDb } from "@fb-bot/db";
import { createGraphApi, type GraphApi, type MetaConfig, parseEncryptionKey } from "@fb-bot/meta";
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
  embeddings: EmbeddingsClient;
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
    embeddings: createEmbeddingsClient({ baseUrl: env.EMBED_URL }),
    encryptionKey: getEncryptionKey(),
    ...overrides,
  };
}

export { close as closeDb, db };
