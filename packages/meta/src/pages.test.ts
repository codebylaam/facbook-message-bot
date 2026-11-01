import { describe, expect, test } from "bun:test";
import type { MetaConfig } from "./config.ts";
import { createGraphApi } from "./graph.ts";
import {
  fetchSubscribedFields,
  SUBSCRIBED_FIELDS,
  subscribeAppToPage,
  unsubscribeAppFromPage,
} from "./pages.ts";
import { createStubFetch } from "./test-support/stub-fetch.ts";

const config: MetaConfig = {
  appId: "app-1",
  appSecret: "secret-1",
  verifyToken: "verify-1",
  graphVersion: "v23.0",
  graphBaseUrl: "https://graph.test",
};

describe("subscribeAppToPage", () => {
  test("posts the documented subscribed fields", async () => {
    const { fetchImpl, calls, searchParams } = createStubFetch([{ body: { success: true } }]);

    const result = await subscribeAppToPage(createGraphApi(config, fetchImpl), {
      pageId: "PAGE_1",
      pageAccessToken: "page-token",
    });

    expect(result).toBe(true);
    expect(calls[0]?.method).toBe("POST");
    expect(calls[0]?.url).toContain("/v23.0/PAGE_1/subscribed_apps");
    expect(searchParams(0).get("subscribed_fields")).toBe(SUBSCRIBED_FIELDS.join(","));
    expect(searchParams(0).get("access_token")).toBe("page-token");
  });

  test("reports success false when facebook omits it", async () => {
    const { fetchImpl } = createStubFetch([{ body: {} }]);

    await expect(
      subscribeAppToPage(createGraphApi(config, fetchImpl), {
        pageId: "PAGE_1",
        pageAccessToken: "page-token",
      }),
    ).resolves.toBe(false);
  });
});

describe("unsubscribeAppFromPage", () => {
  test("deletes the subscription", async () => {
    const { fetchImpl, calls } = createStubFetch([{ body: { success: true } }]);

    const result = await unsubscribeAppFromPage(createGraphApi(config, fetchImpl), {
      pageId: "PAGE_1",
      pageAccessToken: "page-token",
    });

    expect(result).toBe(true);
    expect(calls[0]?.method).toBe("DELETE");
    expect(calls[0]?.url).toContain("/PAGE_1/subscribed_apps");
  });
});

describe("fetchSubscribedFields", () => {
  test("reads the subscribed fields back", async () => {
    const { fetchImpl } = createStubFetch([
      { body: { data: [{ subscribed_fields: ["messages", "feed"] }] } },
    ]);

    await expect(
      fetchSubscribedFields(createGraphApi(config, fetchImpl), {
        pageId: "PAGE_1",
        pageAccessToken: "page-token",
      }),
    ).resolves.toEqual(["messages", "feed"]);
  });

  test("returns an empty list when nothing is subscribed", async () => {
    const { fetchImpl } = createStubFetch([{ body: { data: [] } }]);

    await expect(
      fetchSubscribedFields(createGraphApi(config, fetchImpl), {
        pageId: "PAGE_1",
        pageAccessToken: "page-token",
      }),
    ).resolves.toEqual([]);
  });
});
