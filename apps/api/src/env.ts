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
  }),
  process.env,
);

export const isMetaConfigured =
  env.META_APP_ID.length > 0 && env.META_APP_SECRET.length > 0 && env.META_VERIFY_TOKEN.length > 0;
