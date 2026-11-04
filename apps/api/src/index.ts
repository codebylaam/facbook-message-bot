import { DOCUMENT_MAX_BYTES } from "@fb-bot/shared";
import { createApp } from "./app.ts";
import { env } from "./env.ts";
import { logger } from "./logger.ts";

const app = createApp();

const server = Bun.serve({
  port: env.PORT,
  fetch: app.fetch,
  // A document upload is the largest body this API takes; everything else is JSON.
  maxRequestBodySize: DOCUMENT_MAX_BYTES + 2 * 1024 * 1024,
});

logger.info(`[api] listening on http://localhost:${server.port}`);
