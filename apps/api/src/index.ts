import { createApp } from "./app.ts";
import { env } from "./env.ts";

const app = createApp();

const server = Bun.serve({
  port: env.PORT,
  fetch: app.fetch,
});

console.log(`[api] listening on http://localhost:${server.port}`);
