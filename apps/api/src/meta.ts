import {
  createGraphApi,
  type GraphApi,
  META_SCOPES,
  type MetaConfig,
  parseEncryptionKey,
} from "@fb-bot/meta";
import { env, isMetaConfigured } from "./env.ts";

export { isMetaConfigured };

export const metaConfig: MetaConfig = {
  appId: env.META_APP_ID,
  appSecret: env.META_APP_SECRET,
  verifyToken: env.META_VERIFY_TOKEN,
  graphVersion: env.META_GRAPH_VERSION,
};

export const graphApi: GraphApi = createGraphApi(metaConfig);

export const metaScopes = [...META_SCOPES];

let cachedEncryptionKey: Buffer | undefined;

export function getEncryptionKey(): Buffer {
  if (!cachedEncryptionKey) {
    if (env.TOKEN_ENC_KEY.length === 0) {
      throw new Error("TOKEN_ENC_KEY is not set, so page tokens cannot be stored");
    }

    cachedEncryptionKey = parseEncryptionKey(env.TOKEN_ENC_KEY);
  }

  return cachedEncryptionKey;
}
