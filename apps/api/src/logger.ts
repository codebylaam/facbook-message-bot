import { createLogger } from "@fb-bot/shared/logger";
import { env } from "./env.ts";

export const logger = createLogger("api", env.LOG_LEVEL);
