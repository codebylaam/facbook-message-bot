import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { auth } from "./auth.ts";
import { env } from "./env.ts";
import type { AppEnv } from "./middleware/auth.ts";
import { errorHandler } from "./middleware/error-handler.ts";
import { commentsRoute } from "./routes/comments.ts";
import { conversationsRoute } from "./routes/conversations.ts";
import { eventsRoute } from "./routes/events.ts";
import { faqsRoute } from "./routes/faqs.ts";
import { healthRoute } from "./routes/health.ts";
import { knowledgeRoute } from "./routes/knowledge.ts";
import { meRoute } from "./routes/me.ts";
import { pagesRoute } from "./routes/pages.ts";
import { playgroundRoute } from "./routes/playground.ts";
import { policiesRoute } from "./routes/policies.ts";
import { postsRoute } from "./routes/posts.ts";
import { productsRoute } from "./routes/products.ts";
import { webhookRoute } from "./routes/webhooks.ts";

export function createApp() {
  const app = new Hono<AppEnv>();
  const secure = secureHeaders();

  app.use("*", async (c, next) => {
    // secureHeaders marks resources same-origin, and a browser refuses to read an
    // EventSource body cross-origin under that header. The stream carries no
    // markup, so it gets an explicit policy instead of the full header set.
    if (c.req.path === "/api/events") {
      await next();
      c.header("Cross-Origin-Resource-Policy", "cross-origin");
      return;
    }

    await secure(c, next);
  });

  app.use("*", cors({ origin: env.WEB_ORIGIN, credentials: true }));

  app.onError(errorHandler);

  app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw));

  app.route("/health", healthRoute);
  app.route("/api/me", meRoute);
  app.route("/api/pages", pagesRoute);
  app.route("/api/products", productsRoute);
  app.route("/api/faqs", faqsRoute);
  app.route("/api/policies", policiesRoute);
  app.route("/api/posts", postsRoute);
  app.route("/api/knowledge", knowledgeRoute);
  app.route("/api/comments", commentsRoute);
  app.route("/api/conversations", conversationsRoute);
  app.route("/api/events", eventsRoute);
  app.route("/api/playground", playgroundRoute);
  app.route("/webhooks/meta", webhookRoute);

  return app;
}

export type App = ReturnType<typeof createApp>;
