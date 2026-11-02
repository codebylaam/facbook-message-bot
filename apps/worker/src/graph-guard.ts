import { markPageError } from "@fb-bot/db";
import { isTokenInvalidError } from "@fb-bot/meta";
import type { WorkerDeps } from "./deps.ts";
import { notifyInbox } from "./inbox-events.ts";
import { logger } from "./logger.ts";

type PageRef = { id: string; fbPageId: string };

/**
 * Every outbound Graph call goes through here: it spends the Page's rate budget
 * first, and a token Facebook has rejected marks the Page as broken and tells the
 * seller to reconnect instead of failing quietly on every future message.
 */
export async function guardGraphCall<T>(
  deps: WorkerDeps,
  page: PageRef,
  call: () => Promise<T>,
): Promise<T> {
  deps.rateLimiter.tryAcquire(page.fbPageId);

  try {
    return await call();
  } catch (error) {
    if (isTokenInvalidError(error)) {
      await markPageError(deps.db, page.id, "The Page access token is no longer valid");
      await notifyInbox(deps.db, {
        pageId: page.id,
        kind: "handoff",
        reason: "Reconnect this Page: Facebook rejected its access token",
      });
      logger.warn({ err: error, pageId: page.id }, "page access token is no longer valid");
    }

    throw error;
  }
}
