import { describe, expect, test } from "bun:test";
import type { MetaConfig } from "./config.ts";
import { createGraphApi } from "./graph.ts";
import {
  buildLoginUrl,
  exchangeCodeForShortLivedToken,
  exchangeForLongLivedToken,
  fetchManagedPages,
  META_SCOPES,
} from "./oauth.ts";
import { createStubFetch } from "./test-support/stub-fetch.ts";

const config: MetaConfig = {
  appId: "app-1",
  appSecret: "secret-1",
  verifyToken: "verify-1",
  graphVersion: "v23.0",
  graphBaseUrl: "https://graph.test",
  webBaseUrl: "https://www.facebook.test",
};

describe("buildLoginUrl", () => {
  test("points at the versioned oauth dialog", () => {
    const url = new URL(
      buildLoginUrl(config, { redirectUri: "http://localhost:5173/cb", state: "state-1" }),
    );

    expect(url.origin + url.pathname).toBe("https://www.facebook.test/v23.0/dialog/oauth");
  });

  test("requests every documented scope", () => {
    const url = new URL(
      buildLoginUrl(config, { redirectUri: "http://localhost:5173/cb", state: "state-1" }),
    );

    expect(url.searchParams.get("scope")?.split(",")).toEqual([...META_SCOPES]);
  });

  test("carries the code flow, state and redirect uri", () => {
    const url = new URL(
      buildLoginUrl(config, { redirectUri: "http://localhost:5173/cb", state: "state-1" }),
    );

    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("client_id")).toBe("app-1");
    expect(url.searchParams.get("state")).toBe("state-1");
    expect(url.searchParams.get("redirect_uri")).toBe("http://localhost:5173/cb");
  });

  test("never leaks the app secret", () => {
    expect(buildLoginUrl(config, { redirectUri: "http://x/cb", state: "s" })).not.toContain(
      "secret-1",
    );
  });
});

describe("exchangeForLongLivedToken", () => {
  test("uses the fb_exchange_token grant", async () => {
    const { fetchImpl, searchParams } = createStubFetch([
      { body: { access_token: "long-lived", expires_in: 5_184_000 } },
    ]);

    const result = await exchangeForLongLivedToken(
      createGraphApi(config, fetchImpl),
      config,
      "short-lived",
    );

    expect(result.accessToken).toBe("long-lived");
    expect(result.expiresIn).toBe(5_184_000);
    expect(searchParams(0).get("grant_type")).toBe("fb_exchange_token");
    expect(searchParams(0).get("fb_exchange_token")).toBe("short-lived");
    expect(searchParams(0).get("client_id")).toBe("app-1");
    expect(searchParams(0).get("client_secret")).toBe("secret-1");
  });

  test("throws when facebook returns no token", async () => {
    const { fetchImpl } = createStubFetch([{ body: {} }]);

    await expect(
      exchangeForLongLivedToken(createGraphApi(config, fetchImpl), config, "short-lived"),
    ).rejects.toThrow(/did not return a long-lived access token/);
  });
});

describe("exchangeCodeForShortLivedToken", () => {
  test("sends the code and redirect uri", async () => {
    const { fetchImpl, searchParams } = createStubFetch([{ body: { access_token: "short" } }]);

    const result = await exchangeCodeForShortLivedToken(createGraphApi(config, fetchImpl), config, {
      code: "the-code",
      redirectUri: "http://localhost:5173/cb",
    });

    expect(result.accessToken).toBe("short");
    expect(searchParams(0).get("code")).toBe("the-code");
    expect(searchParams(0).get("redirect_uri")).toBe("http://localhost:5173/cb");
  });

  test("throws when facebook returns no token", async () => {
    const { fetchImpl } = createStubFetch([{ body: {} }]);

    await expect(
      exchangeCodeForShortLivedToken(createGraphApi(config, fetchImpl), config, {
        code: "c",
        redirectUri: "http://x/cb",
      }),
    ).rejects.toThrow(/for the supplied code/);
  });
});

describe("fetchManagedPages", () => {
  test("maps pages and keeps their tokens", async () => {
    const { fetchImpl, searchParams } = createStubFetch([
      {
        body: {
          data: [
            {
              id: "PAGE_1",
              name: "Dhaka Threads",
              access_token: "page-token-1",
              tasks: ["MESSAGING"],
              category: "Clothing",
            },
          ],
        },
      },
    ]);

    const pages = await fetchManagedPages(createGraphApi(config, fetchImpl), "user-token");

    expect(pages).toEqual([
      {
        id: "PAGE_1",
        name: "Dhaka Threads",
        accessToken: "page-token-1",
        tasks: ["MESSAGING"],
        category: "Clothing",
      },
    ]);
    expect(searchParams(0).get("access_token")).toBe("user-token");
    expect(searchParams(0).get("fields")).toContain("access_token");
  });

  test("drops pages without a token", async () => {
    const { fetchImpl } = createStubFetch([
      {
        body: {
          data: [
            { id: "PAGE_1", name: "No token" },
            { id: "PAGE_2", name: "Has token", access_token: "t" },
          ],
        },
      },
    ]);

    const pages = await fetchManagedPages(createGraphApi(config, fetchImpl), "user-token");

    expect(pages.map((page) => page.id)).toEqual(["PAGE_2"]);
  });

  test("returns an empty list when data is missing", async () => {
    const { fetchImpl } = createStubFetch([{ body: {} }]);

    await expect(
      fetchManagedPages(createGraphApi(config, fetchImpl), "user-token"),
    ).resolves.toEqual([]);
  });

  test("falls back to the id when the page has no name", async () => {
    const { fetchImpl } = createStubFetch([
      { body: { data: [{ id: "PAGE_1", access_token: "t" }] } },
    ]);

    const pages = await fetchManagedPages(createGraphApi(config, fetchImpl), "user-token");

    expect(pages[0]?.name).toBe("PAGE_1");
    expect(pages[0]?.tasks).toEqual([]);
  });
});
