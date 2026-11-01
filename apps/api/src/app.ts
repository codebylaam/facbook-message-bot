import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { auth } from "./auth.ts";
import { env } from "./env.ts";
import type { AppEnv } from "./middleware/auth.ts";
import { errorHandler } from "./middleware/error-handler.ts";
import { healthRoute } from "./routes/health.ts";
import { meRoute } from "./routes/me.ts";

export function createApp() {
  const app = new Hono<AppEnv>();

  app.use("*", secureHeaders());
  app.use("*", cors({ origin: env.WEB_ORIGIN, credentials: true }));

  app.onError(errorHandler);

  app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw));

  app.route("/health", healthRoute);
  app.route("/api/me", meRoute);

  return app;
}

export type App = ReturnType<typeof createApp>;
