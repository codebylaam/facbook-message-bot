import { parseEnv, serverEnvSchema } from "@fb-bot/shared";
import { z } from "zod";

export const env = parseEnv(
  serverEnvSchema.extend({
    LOG_LEVEL: z.string().default("info"),
    GRAPH_CALLS_PER_HOUR: z.coerce.number().int().positive().default(180),
    CMD_API_KEY: z.string().default(""),
    CMD_BASE_URL: z.string().default("https://api.commandcode.ai/provider/v1"),
    LLM_MODEL: z.string().default("deepseek/deepseek-v4-flash"),

    CF_ACCOUNT_ID: z.string().default(""),
    CF_API_TOKEN: z.string().default(""),
    CF_EMBED_MODEL: z.string().default("@cf/baai/bge-m3"),

    EMBED_URL: z.string().default(""),

    META_APP_ID: z.string().default(""),
    META_APP_SECRET: z.string().default(""),
    META_VERIFY_TOKEN: z.string().default(""),
    META_GRAPH_VERSION: z.string().default("v23.0"),

    TOKEN_ENC_KEY: z.string().default(""),

    DEFAULT_AI_REPLIES_LIMIT: z.coerce.number().int().positive().default(1000),
    REPLY_TYPING_DELAY_MS: z.coerce.number().int().nonnegative().default(700),
  }),
  process.env,
);

export function requireTokenEncKey(): string {
  if (env.TOKEN_ENC_KEY.length === 0) {
    throw new Error("TOKEN_ENC_KEY is not set, so page tokens cannot be decrypted");
  }

  return env.TOKEN_ENC_KEY;
}
