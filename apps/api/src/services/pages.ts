import { type Db, deletePageForOwner, findPageByFbPageId, upsertPageForOwner } from "@fb-bot/db";
import {
  decryptToken,
  encryptToken,
  exchangeForLongLivedToken,
  type FacebookPageCandidate,
  fetchManagedPages,
  type GraphApi,
  GraphApiError,
  type MetaConfig,
  subscribeAppToPage,
  unsubscribeAppFromPage,
} from "@fb-bot/meta";

export type MetaDeps = {
  graphApi: GraphApi;
  config: MetaConfig;
  encryptionKey: Buffer;
};

export class PageConnectionError extends Error {
  readonly status: 400 | 404 | 409 | 502;

  constructor(message: string, status: 400 | 404 | 409 | 502) {
    super(message);
    this.name = "PageConnectionError";
    this.status = status;
  }
}

export type DiscoveredPage = {
  id: string;
  name: string;
  category?: string;
  tasks: string[];
};

export type ConnectedPage = {
  id: string;
  fbPageId: string;
  name: string;
  subscribed: boolean;
};

function describe(error: unknown): string {
  return error instanceof Error ? error.message : "unknown error";
}

function mapGraphError(error: unknown): PageConnectionError | null {
  if (!(error instanceof GraphApiError)) {
    return null;
  }

  if (error.status >= 500) {
    return new PageConnectionError(`Facebook is unavailable: ${error.message}`, 502);
  }

  return new PageConnectionError(`Facebook rejected the request: ${error.message}`, 400);
}

async function resolveManagedPages(
  deps: MetaDeps,
  userAccessToken: string,
): Promise<FacebookPageCandidate[]> {
  try {
    const { accessToken } = await exchangeForLongLivedToken(
      deps.graphApi,
      deps.config,
      userAccessToken,
    );

    return await fetchManagedPages(deps.graphApi, accessToken);
  } catch (error) {
    throw mapGraphError(error) ?? error;
  }
}

export async function discoverPages(
  deps: MetaDeps,
  userAccessToken: string,
): Promise<DiscoveredPage[]> {
  const pages = await resolveManagedPages(deps, userAccessToken);

  return pages.map((page) => ({
    id: page.id,
    name: page.name,
    category: page.category,
    tasks: page.tasks,
  }));
}

export async function connectPage(
  db: Db,
  deps: MetaDeps,
  input: { ownerId: string; userAccessToken: string; fbPageId: string },
): Promise<ConnectedPage> {
  const pages = await resolveManagedPages(deps, input.userAccessToken);
  const candidate = pages.find((page) => page.id === input.fbPageId);

  if (!candidate) {
    throw new PageConnectionError(
      "That Page is not available to the account you signed in with",
      404,
    );
  }

  const existing = await findPageByFbPageId(db, candidate.id);

  if (existing && existing.ownerId !== input.ownerId) {
    throw new PageConnectionError("That Page is already connected to another account", 409);
  }

  let subscribed = false;

  try {
    subscribed = await subscribeAppToPage(deps.graphApi, {
      pageId: candidate.id,
      pageAccessToken: candidate.accessToken,
    });
  } catch (error) {
    throw (
      mapGraphError(error) ??
      new PageConnectionError(`Could not subscribe the app to that Page: ${describe(error)}`, 502)
    );
  }

  const page = await upsertPageForOwner(db, input.ownerId, {
    fbPageId: candidate.id,
    name: candidate.name,
    accessTokenEncrypted: encryptToken(candidate.accessToken, deps.encryptionKey),
  });

  if (!page) {
    throw new PageConnectionError("Could not save the connected Page", 502);
  }

  return {
    id: page.id,
    fbPageId: page.fbPageId,
    name: page.name,
    subscribed,
  };
}

export async function disconnectPage(
  db: Db,
  deps: MetaDeps | null,
  input: { ownerId: string; pageId: string; fbPageId: string; accessTokenEncrypted: string },
): Promise<boolean> {
  if (deps) {
    try {
      const pageAccessToken = decryptToken(input.accessTokenEncrypted, deps.encryptionKey);
      await unsubscribeAppFromPage(deps.graphApi, {
        pageId: input.fbPageId,
        pageAccessToken,
      });
    } catch {
      // The token may already be revoked on Meta's side, and the local record still has to go.
    }
  }

  const deleted = await deletePageForOwner(db, input.ownerId, input.pageId);

  return deleted.length > 0;
}
