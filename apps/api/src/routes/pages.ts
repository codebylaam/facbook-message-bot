import { findPageForOwner, listPagesForOwner } from "@fb-bot/db";
import { connectPageSchema, discoverPagesSchema, QUEUES } from "@fb-bot/shared";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { db } from "../db.ts";
import { getEncryptionKey, graphApi, isMetaConfigured, metaConfig, metaScopes } from "../meta.ts";
import { type AppEnv, requireSession } from "../middleware/auth.ts";
import { enqueue } from "../queue.ts";
import {
  connectPage,
  disconnectPage,
  discoverPages,
  type MetaDeps,
  PageConnectionError,
} from "../services/pages.ts";

export const pagesRoute = new Hono<AppEnv>();

pagesRoute.use("*", requireSession);

function requireMetaDeps(): MetaDeps {
  if (!isMetaConfigured) {
    throw new HTTPException(503, {
      message: "The Facebook app is not configured on this server",
    });
  }

  try {
    return { graphApi, config: metaConfig, encryptionKey: getEncryptionKey() };
  } catch (error) {
    throw new HTTPException(503, {
      message: error instanceof Error ? error.message : "Facebook is not configured",
    });
  }
}

function optionalMetaDeps(): MetaDeps | null {
  try {
    return requireMetaDeps();
  } catch {
    return null;
  }
}

function toPageSummary(page: Awaited<ReturnType<typeof listPagesForOwner>>[number]) {
  return {
    id: page.id,
    fbPageId: page.fbPageId,
    name: page.name,
    botEnabled: page.botEnabled,
    webhookStatus: page.webhookStatus,
    commentMode: page.commentMode,
    confidenceThreshold: page.confidenceThreshold,
    lastSyncedAt: page.lastSyncedAt?.toISOString() ?? null,
    createdAt: page.createdAt.toISOString(),
  };
}

function handlePageError(error: unknown): never {
  if (error instanceof PageConnectionError) {
    throw new HTTPException(error.status, { message: error.message });
  }

  throw error;
}

pagesRoute.get("/login-config", (c) =>
  c.json({
    appId: metaConfig.appId,
    graphVersion: metaConfig.graphVersion,
    scopes: metaScopes,
  }),
);

pagesRoute.get("/", async (c) => {
  const user = c.get("user");
  const pages = await listPagesForOwner(db, user.id);

  return c.json({ pages: pages.map(toPageSummary) });
});

pagesRoute.post("/discover", zValidator("json", discoverPagesSchema), async (c) => {
  const deps = requireMetaDeps();
  const { accessToken } = c.req.valid("json");

  try {
    const pages = await discoverPages(deps, accessToken);
    return c.json({ pages });
  } catch (error) {
    return handlePageError(error);
  }
});

pagesRoute.post("/", zValidator("json", connectPageSchema), async (c) => {
  const deps = requireMetaDeps();
  const user = c.get("user");
  const { accessToken, fbPageId } = c.req.valid("json");

  try {
    const page = await connectPage(db, deps, {
      ownerId: user.id,
      userAccessToken: accessToken,
      fbPageId,
    });

    await enqueue(QUEUES.ingestPage, { pageId: page.id });

    return c.json({ page }, 201);
  } catch (error) {
    return handlePageError(error);
  }
});

pagesRoute.post("/:id/resync", async (c) => {
  const user = c.get("user");
  const page = await findPageForOwner(db, user.id, c.req.param("id"));

  if (!page) {
    throw new HTTPException(404, { message: "Page not found" });
  }

  await enqueue(QUEUES.ingestPage, { pageId: page.id });

  return c.json({ queued: true, pageId: page.id });
});

pagesRoute.delete("/:id", async (c) => {
  const user = c.get("user");
  const page = await findPageForOwner(db, user.id, c.req.param("id"));

  if (!page) {
    throw new HTTPException(404, { message: "Page not found" });
  }

  await disconnectPage(db, optionalMetaDeps(), {
    ownerId: user.id,
    pageId: page.id,
    fbPageId: page.fbPageId,
    accessTokenEncrypted: page.accessTokenEncrypted,
  });

  return c.json({ success: true });
});
