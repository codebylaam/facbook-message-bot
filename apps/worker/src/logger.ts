import { createLogger } from "@fb-bot/shared/logger";
import { env } from "./env.ts";

export const logger = createLogger("worker", env.LOG_LEVEL);
