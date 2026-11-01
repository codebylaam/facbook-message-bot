import { describe, expect, test } from "bun:test";
import type { MetaConfig } from "./config.ts";
import { createGraphApi } from "./graph.ts";
import { fetchPagePosts, lookbackDate, MAX_POSTS } from "./posts.ts";
import { createStubFetch } from "./test-support/stub-fetch.ts";

const config: MetaConfig = {
  appId: "app-1",
  appSecret: "secret-1",
  verifyToken: "verify-1",
  graphVersion: "v23.0",
  graphBaseUrl: "https://graph.test",
};

function node(id: string, extra: Record<string, unknown> = {}) {
  return { id, message: `post ${id}`, created_time: "2026-01-02T03:04:05+0000", ...extra };
}

describe("fetchPagePosts", () => {
  test("maps the post fields", async () => {
    const { fetchImpl, searchParams } = createStubFetch([
      { body: { data: [node("POST_1", { permalink_url: "https://fb.test/p/1" })] } },
    ]);

    const posts = await fetchPagePosts(createGraphApi(config, fetchImpl), {
      pageId: "PAGE_1",
      pageAccessToken: "page-token",
    });

    expect(posts).toHaveLength(1);
    expect(posts[0]?.id).toBe("POST_1");
    expect(posts[0]?.message).toBe("post POST_1");
    expect(posts[0]?.permalink).toBe("https://fb.test/p/1");
    expect(posts[0]?.createdTime?.toISOString()).toBe("2026-01-02T03:04:05.000Z");
    expect(searchParams(0).get("access_token")).toBe("page-token");
    expect(searchParams(0).get("fields")).toContain("attachments");
  });

  test("treats a blank message as null", async () => {
    const { fetchImpl } = createStubFetch([
      { body: { data: [node("POST_1", { message: "   " })] } },
    ]);

    const posts = await fetchPagePosts(createGraphApi(config, fetchImpl), {
      pageId: "PAGE_1",
      pageAccessToken: "t",
    });

    expect(posts[0]?.message).toBeNull();
  });

  test("collects images from nested attachments", async () => {
    const { fetchImpl } = createStubFetch([
      {
        body: {
          data: [
            node("POST_1", {
              attachments: {
                data: [
                  {
                    media: { image: { src: "https://img/1.jpg" } },
                    subattachments: {
                      data: [
                        { media: { image: { src: "https://img/2.jpg" } } },
                        { media: { image: { src: "https://img/3.jpg" } } },
                      ],
                    },
                  },
                ],
              },
            }),
          ],
        },
      },
    ]);

    const posts = await fetchPagePosts(createGraphApi(config, fetchImpl), {
      pageId: "PAGE_1",
      pageAccessToken: "t",
    });

    expect(posts[0]?.images).toEqual([
      "https://img/1.jpg",
      "https://img/2.jpg",
      "https://img/3.jpg",
    ]);
  });

  test("pages through the cursor until the limit", async () => {
    const { fetchImpl, calls } = createStubFetch([
      {
        body: {
          data: [node("POST_1"), node("POST_2")],
          paging: { cursors: { after: "CURSOR_1" } },
        },
      },
      { body: { data: [node("POST_3")] } },
    ]);

    const posts = await fetchPagePosts(createGraphApi(config, fetchImpl), {
      pageId: "PAGE_1",
      pageAccessToken: "t",
      limit: 10,
    });

    expect(posts.map((post) => post.id)).toEqual(["POST_1", "POST_2", "POST_3"]);
    expect(calls).toHaveLength(2);
    expect(new URL(calls[1]?.url ?? "").searchParams.get("after")).toBe("CURSOR_1");
  });

  test("stops once the limit is reached", async () => {
    const { fetchImpl, calls } = createStubFetch([
      {
        body: {
          data: [node("POST_1"), node("POST_2"), node("POST_3")],
          paging: { cursors: { after: "CURSOR_1" } },
        },
      },
      { body: { data: [node("POST_4")] } },
    ]);

    const posts = await fetchPagePosts(createGraphApi(config, fetchImpl), {
      pageId: "PAGE_1",
      pageAccessToken: "t",
      limit: 2,
    });

    expect(posts).toHaveLength(2);
    expect(calls).toHaveLength(1);
  });

  test("stops when there is no cursor", async () => {
    const { fetchImpl, calls } = createStubFetch([{ body: { data: [node("POST_1")] } }]);

    await fetchPagePosts(createGraphApi(config, fetchImpl), {
      pageId: "PAGE_1",
      pageAccessToken: "t",
    });

    expect(calls).toHaveLength(1);
  });

  test("stops when a page comes back empty", async () => {
    const { fetchImpl, calls } = createStubFetch([
      { body: { data: [node("POST_1")], paging: { cursors: { after: "C1" } } } },
      { body: { data: [] } },
    ]);

    const posts = await fetchPagePosts(createGraphApi(config, fetchImpl), {
      pageId: "PAGE_1",
      pageAccessToken: "t",
    });

    expect(posts).toHaveLength(1);
    expect(calls).toHaveLength(2);
  });

  test("sends the lookback as a unix timestamp", async () => {
    const { fetchImpl, searchParams } = createStubFetch([{ body: { data: [] } }]);
    const since = new Date("2026-01-01T00:00:00Z");

    await fetchPagePosts(createGraphApi(config, fetchImpl), {
      pageId: "PAGE_1",
      pageAccessToken: "t",
      since,
    });

    expect(searchParams(0).get("since")).toBe(String(Math.floor(since.getTime() / 1000)));
  });

  test("omits since when it is not given", async () => {
    const { fetchImpl, searchParams } = createStubFetch([{ body: { data: [] } }]);

    await fetchPagePosts(createGraphApi(config, fetchImpl), {
      pageId: "PAGE_1",
      pageAccessToken: "t",
    });

    expect(searchParams(0).has("since")).toBe(false);
  });

  test("defaults the cap to three hundred posts", () => {
    expect(MAX_POSTS).toBe(300);
  });

  test("ignores an unparseable created time", async () => {
    const { fetchImpl } = createStubFetch([
      { body: { data: [node("POST_1", { created_time: "not a date" })] } },
    ]);

    const posts = await fetchPagePosts(createGraphApi(config, fetchImpl), {
      pageId: "PAGE_1",
      pageAccessToken: "t",
    });

    expect(posts[0]?.createdTime).toBeNull();
  });
});

describe("lookbackDate", () => {
  test("goes back six months by default", () => {
    expect(lookbackDate(new Date("2026-07-15T00:00:00Z")).toISOString()).toStartWith("2026-01-15");
  });

  test("accepts a custom number of months", () => {
    expect(lookbackDate(new Date("2026-07-15T00:00:00Z"), 1).toISOString()).toStartWith(
      "2026-06-15",
    );
  });
});
