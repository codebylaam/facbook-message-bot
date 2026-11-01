import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { env } from "./env.ts";
import { errorHandler } from "./middleware/error-handler.ts";
import { healthRoute } from "./routes/health.ts";

export function createApp() {
  const app = new Hono();

  app.use("*", secureHeaders());
  app.use("*", cors({ origin: env.WEB_ORIGIN, credentials: true }));

  app.onError(errorHandler);

  app.route("/health", healthRoute);

  return app;
}

export type App = ReturnType<typeof createApp>;
