import { createApp } from "./app.ts";
import { env } from "./env.ts";
import { logger } from "./logger.ts";

const app = createApp();

const server = Bun.serve({
  port: env.PORT,
  fetch: app.fetch,
});

logger.info(`[api] listening on http://localhost:${server.port}`);
