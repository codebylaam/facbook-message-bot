import { parseEnv, serverEnvSchema } from "@fb-bot/shared";

export const env = parseEnv(serverEnvSchema, process.env);
