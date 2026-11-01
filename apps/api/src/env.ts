import { parseEnv, serverEnvSchema } from "@fb-bot/shared";
import { z } from "zod";

export const env = parseEnv(
  serverEnvSchema.extend({
    WEB_ORIGIN: z.string().default("http://localhost:5173"),
    BETTER_AUTH_SECRET: z.string().min(1),
    BETTER_AUTH_URL: z.string().default("http://localhost:3000"),

    META_APP_ID: z.string().default(""),
    META_APP_SECRET: z.string().default(""),
    META_VERIFY_TOKEN: z.string().default(""),
    META_GRAPH_VERSION: z.string().default("v23.0"),
    TOKEN_ENC_KEY: z.string().default(""),

    CMD_API_KEY: z.string().default(""),
    CMD_BASE_URL: z.string().default("https://api.commandcode.ai/provider/v1"),
    LLM_MODEL: z.string().default("deepseek/deepseek-v4-flash"),
    CF_ACCOUNT_ID: z.string().default(""),
    CF_API_TOKEN: z.string().default(""),
    CF_EMBED_MODEL: z.string().default("@cf/baai/bge-m3"),

    EMBED_URL: z.string().default(""),
  }),
  process.env,
);

export const isMetaConfigured =
  env.META_APP_ID.length > 0 && env.META_APP_SECRET.length > 0 && env.META_VERIFY_TOKEN.length > 0;

export const isLlmConfigured = env.CMD_API_KEY.length > 0;
