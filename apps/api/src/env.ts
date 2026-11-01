import { parseEnv, serverEnvSchema } from "@fb-bot/shared";
import { z } from "zod";

export const env = parseEnv(
  serverEnvSchema.extend({
    WEB_ORIGIN: z.string().default("http://localhost:5173"),
    BETTER_AUTH_SECRET: z.string().min(1),
    BETTER_AUTH_URL: z.string().default("http://localhost:3000"),
  }),
  process.env,
);
