import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { randomBytes } from "node:crypto";
import { createDb, fbPages, users } from "@fb-bot/db";
import { createGraphApi, decryptToken, type FetchLike, type MetaConfig } from "@fb-bot/meta";
import { eq, inArray } from "drizzle-orm";
import {
  connectPage,
  disconnectPage,
  discoverPages,
  type MetaDeps,
  PageConnectionError,
} from "./pages.ts";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is required to run the page connection tests");
}

const { db, close } = createDb(url, { max: 2 });

const config: MetaConfig = {
  appId: "app-1",
  appSecret: "secret-1",
  verifyToken: "verify-1",
  graphVersion: "v23.0",
  graphBaseUrl: "https://graph.test",
};

type StubHandler = {
  match: RegExp;
  method?: string;
  status?: number;
  body: unknown;
};

function createGraphStub(handlers: StubHandler[]) {
  const calls: Array<{ url: string; method: string }> = [];

  const fetchImpl: FetchLike = async (input, init) => {
    const method = init?.method ?? "GET";
    calls.push({ url: input, method });

    const handler = handlers.find(
      (candidate) =>
        candidate.match.test(input) &&
        (candidate.method === undefined || candidate.method === method),
    );

    if (!handler) {
      return new Response(JSON.stringify({ error: { message: `no stub for ${input}` } }), {
        status: 404,
      });
    }

    return new Response(JSON.stringify(handler.body), { status: handler.status ?? 200 });
  };

  return { fetchImpl, calls };
}

const PAGE_ACCOUNTS = {
  data: [
    { id: "PAGE_1", name: "Dhaka Threads", access_token: "page-token-1", tasks: ["MESSAGING"] },
    { id: "PAGE_2", name: "Chittagong Crafts", access_token: "page-token-2", tasks: [] },
  ],
};

function standardHandlers(): StubHandler[] {
  return [
    { match: /\/oauth\/access_token/, body: { access_token: "long-lived-user-token" } },
    { match: /\/me\/accounts/, body: PAGE_ACCOUNTS },
    { match: /\/subscribed_apps/, method: "POST", body: { success: true } },
    { match: /\/subscribed_apps/, method: "DELETE", body: { success: true } },
  ];
}

function depsWith(handlers: StubHandler[]): MetaDeps {
  const { fetchImpl } = createGraphStub(handlers);

  return { graphApi: createGraphApi(config, fetchImpl), config, encryptionKey: randomBytes(32) };
}

async function storedPage(fbPageId: string) {
  const [page] = await db.select().from(fbPages).where(eq(fbPages.fbPageId, fbPageId));
  return page;
}

const runId = crypto.randomUUID().slice(0, 8);
const ownerA = { id: `page-test-a-${runId}`, name: "Owner A", email: `pa-${runId}@test.local` };
const ownerB = { id: `page-test-b-${runId}`, name: "Owner B", email: `pb-${runId}@test.local` };

beforeAll(async () => {
  await db.delete(fbPages).where(inArray(fbPages.fbPageId, ["PAGE_1", "PAGE_2"]));
  await db.insert(users).values([ownerA, ownerB]);
});

afterAll(async () => {
  await db.delete(fbPages).where(inArray(fbPages.fbPageId, ["PAGE_1", "PAGE_2"]));
  await db.delete(users).where(inArray(users.id, [ownerA.id, ownerB.id]));
  await close();
});

describe("discoverPages", () => {
  test("returns page candidates without their tokens", async () => {
    const pages = await discoverPages(depsWith(standardHandlers()), "short-lived-token");

    expect(pages).toEqual([
      { id: "PAGE_1", name: "Dhaka Threads", category: undefined, tasks: ["MESSAGING"] },
      { id: "PAGE_2", name: "Chittagong Crafts", category: undefined, tasks: [] },
    ]);
    expect(JSON.stringify(pages)).not.toContain("page-token");
  });
});

describe("connectPage", () => {
  test("subscribes the app and stores the page token encrypted", async () => {
    const deps = depsWith(standardHandlers());

    const connected = await connectPage(db, deps, {
      ownerId: ownerA.id,
      userAccessToken: "short-lived-token",
      fbPageId: "PAGE_1",
    });

    expect(connected.fbPageId).toBe("PAGE_1");
    expect(connected.name).toBe("Dhaka Threads");
    expect(connected.subscribed).toBe(true);

    const stored = await storedPage("PAGE_1");
    expect(stored?.ownerId).toBe(ownerA.id);

    const ciphertext = stored?.accessTokenEncrypted ?? "";
    expect(ciphertext).not.toBe("page-token-1");
    expect(ciphertext).not.toContain("page-token-1");
    expect(decryptToken(ciphertext, deps.encryptionKey)).toBe("page-token-1");
  });

  test("sends the documented subscribed fields", async () => {
    const { fetchImpl, calls } = createGraphStub(standardHandlers());

    await connectPage(
      db,
      { graphApi: createGraphApi(config, fetchImpl), config, encryptionKey: randomBytes(32) },
      { ownerId: ownerA.id, userAccessToken: "short-lived-token", fbPageId: "PAGE_1" },
    );

    const subscribeCall = calls.find((call) => call.url.includes("subscribed_apps"));
    const subscribedFields = new URL(subscribeCall?.url ?? "").searchParams.get(
      "subscribed_fields",
    );

    expect(subscribedFields).toBe("messages,messaging_postbacks,message_echoes,feed");
  });

  test("exchanges the short-lived token before listing pages", async () => {
    const { fetchImpl, calls } = createGraphStub(standardHandlers());

    await connectPage(
      db,
      { graphApi: createGraphApi(config, fetchImpl), config, encryptionKey: randomBytes(32) },
      { ownerId: ownerA.id, userAccessToken: "short-lived-token", fbPageId: "PAGE_1" },
    );

    const exchangeCall = calls.find((call) => call.url.includes("/oauth/access_token"));
    const accountsCall = calls.find((call) => call.url.includes("/me/accounts"));

    expect(exchangeCall).toBeDefined();
    expect(accountsCall).toBeDefined();
    expect(new URL(accountsCall?.url ?? "").searchParams.get("access_token")).toBe(
      "long-lived-user-token",
    );
  });

  test("rejects a page the account cannot manage", async () => {
    const error = await connectPage(db, depsWith(standardHandlers()), {
      ownerId: ownerA.id,
      userAccessToken: "short-lived-token",
      fbPageId: "PAGE_UNKNOWN",
    }).catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(PageConnectionError);
    expect((error as PageConnectionError).status).toBe(404);
  });

  test("refuses to take over a page owned by someone else", async () => {
    const error = await connectPage(db, depsWith(standardHandlers()), {
      ownerId: ownerB.id,
      userAccessToken: "short-lived-token",
      fbPageId: "PAGE_1",
    }).catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(PageConnectionError);
    expect((error as PageConnectionError).status).toBe(409);

    const rows = await db.select().from(fbPages).where(eq(fbPages.fbPageId, "PAGE_1"));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.ownerId).toBe(ownerA.id);
  });

  test("reconnecting the same page updates instead of duplicating", async () => {
    await connectPage(db, depsWith(standardHandlers()), {
      ownerId: ownerA.id,
      userAccessToken: "short-lived-token",
      fbPageId: "PAGE_1",
    });

    const rows = await db.select().from(fbPages).where(eq(fbPages.fbPageId, "PAGE_1"));

    expect(rows).toHaveLength(1);
  });

  test("maps a rejected subscription to a 400 with the Facebook message", async () => {
    const handlers = standardHandlers().map((handler) =>
      handler.method === "POST"
        ? {
            ...handler,
            status: 400,
            body: { error: { message: "Permission denied", code: 200 } },
          }
        : handler,
    );

    const error = await connectPage(db, depsWith(handlers), {
      ownerId: ownerB.id,
      userAccessToken: "short-lived-token",
      fbPageId: "PAGE_2",
    }).catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(PageConnectionError);
    expect((error as PageConnectionError).status).toBe(400);
    expect((error as PageConnectionError).message).toContain("Permission denied");
  });

  test("maps a Facebook outage during the token exchange to a 502", async () => {
    const handlers = standardHandlers().map((handler) =>
      handler.match.test("/oauth/access_token")
        ? { ...handler, status: 500, body: { error: { message: "Please retry" } } }
        : handler,
    );

    const error = await connectPage(db, depsWith(handlers), {
      ownerId: ownerB.id,
      userAccessToken: "short-lived-token",
      fbPageId: "PAGE_1",
    }).catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(PageConnectionError);
    expect((error as PageConnectionError).status).toBe(502);
    expect((error as PageConnectionError).message).toContain("Facebook is unavailable");
  });

  test("maps a rejected token to a 400 on discover", async () => {
    const handlers = standardHandlers().map((handler) =>
      handler.match.test("/oauth/access_token")
        ? { ...handler, status: 400, body: { error: { message: "Invalid Client ID", code: 101 } } }
        : handler,
    );

    const error = await discoverPages(depsWith(handlers), "bad-token").catch(
      (thrown: unknown) => thrown,
    );

    expect(error).toBeInstanceOf(PageConnectionError);
    expect((error as PageConnectionError).status).toBe(400);
    expect((error as PageConnectionError).message).toContain("Invalid Client ID");
  });
});

describe("disconnectPage", () => {
  test("unsubscribes and removes the owner's page", async () => {
    const deps = depsWith(standardHandlers());

    await connectPage(db, deps, {
      ownerId: ownerB.id,
      userAccessToken: "short-lived-token",
      fbPageId: "PAGE_2",
    });

    const stored = await storedPage("PAGE_2");
    const { fetchImpl, calls } = createGraphStub(standardHandlers());

    const removed = await disconnectPage(
      db,
      { graphApi: createGraphApi(config, fetchImpl), config, encryptionKey: deps.encryptionKey },
      {
        ownerId: ownerB.id,
        pageId: stored?.id ?? "",
        fbPageId: "PAGE_2",
        accessTokenEncrypted: stored?.accessTokenEncrypted ?? "",
      },
    );

    expect(removed).toBe(true);
    expect(calls.some((call) => call.method === "DELETE")).toBe(true);

    const rows = await db.select().from(fbPages).where(eq(fbPages.fbPageId, "PAGE_2"));
    expect(rows).toHaveLength(0);
  });

  test("cannot remove another owner's page", async () => {
    const stored = await storedPage("PAGE_1");

    const removed = await disconnectPage(db, null, {
      ownerId: ownerB.id,
      pageId: stored?.id ?? "",
      fbPageId: "PAGE_1",
      accessTokenEncrypted: stored?.accessTokenEncrypted ?? "",
    });

    expect(removed).toBe(false);

    const rows = await db.select().from(fbPages).where(eq(fbPages.fbPageId, "PAGE_1"));
    expect(rows).toHaveLength(1);
  });

  test("deletes the local record even when Meta is not configured", async () => {
    const stored = await storedPage("PAGE_1");
    if (!stored) {
      throw new Error("expected PAGE_1 to be connected");
    }

    const removed = await disconnectPage(db, null, {
      ownerId: ownerA.id,
      pageId: stored.id,
      fbPageId: "PAGE_1",
      accessTokenEncrypted: stored.accessTokenEncrypted,
    });

    expect(removed).toBe(true);

    const rows = await db.select().from(fbPages).where(eq(fbPages.fbPageId, "PAGE_1"));
    expect(rows).toHaveLength(0);
  });
});
