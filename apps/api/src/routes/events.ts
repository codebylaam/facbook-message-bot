import { listPagesForOwner } from "@fb-bot/db";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import postgres from "postgres";
import { db } from "../db.ts";
import { env } from "../env.ts";
import { logger } from "../logger.ts";
import { type AppEnv, requireSession } from "../middleware/auth.ts";

export const eventsRoute = new Hono<AppEnv>();

eventsRoute.use("*", requireSession);

const HEARTBEAT_MS = 25_000;

/**
 * A live feed for the inbox. The worker publishes to the postgres channel, so the
 * API never has to know which browser tabs are open; it just relays what belongs
 * to the pages this seller owns.
 */
eventsRoute.get("/", async (c) => {
  const user = c.get("user");
  const pages = await listPagesForOwner(db, user.id);
  const pageIds = new Set(pages.map((page) => page.id));

  return streamSSE(c, async (stream) => {
    const client = postgres(env.DATABASE_URL, { max: 1, onnotice: () => {} });

    const close = async () => {
      try {
        await client.end({ timeout: 1 });
      } catch {
        // the connection is already going away
      }
    };

    await stream.writeSSE({
      event: "ready",
      data: JSON.stringify({ pages: pageIds.size }),
    });

    const listener = await client.listen("inbox_events", async (payload: string) => {
      try {
        const event = JSON.parse(payload) as { pageId?: string };

        if (!event.pageId || !pageIds.has(event.pageId)) {
          return;
        }

        await stream.writeSSE({ event: "inbox", data: payload });
      } catch (error) {
        logger.warn({ err: error }, "[api] could not relay an inbox event");
      }
    });

    const heartbeat = setInterval(() => {
      void stream.writeSSE({ event: "ping", data: String(Date.now()) }).catch(() => {});
    }, HEARTBEAT_MS);

    await new Promise<void>((resolve) => {
      stream.onAbort(() => {
        clearInterval(heartbeat);
        void listener
          .unlisten()
          .catch(() => {})
          .then(close)
          .finally(resolve);
      });
    });
  });
});
