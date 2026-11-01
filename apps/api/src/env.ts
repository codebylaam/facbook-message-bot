import { parseEnv, serverEnvSchema } from "@fb-bot/shared";
import { z } from "zod";

export const env = parseEnv(
  serverEnvSchema.extend({
    WEB_ORIGIN: z.string().default("http://localhost:5173"),
  }),
  process.env,
);
