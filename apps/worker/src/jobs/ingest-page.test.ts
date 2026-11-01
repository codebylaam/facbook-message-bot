import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { randomBytes } from "node:crypto";
import type { EmbeddingsClient, LlmClient } from "@fb-bot/ai";
import {
  countChunksForPage,
  createDb,
  fbPages,
  knowledgeChunks,
  listChunksForPage,
  listPostsForPage,
  listProductsForPage,
  pageProfile,
  users,
} from "@fb-bot/db";
import { encryptToken, type GraphApi } from "@fb-bot/meta";
import { eq, inArray } from "drizzle-orm";
import type { WorkerDeps } from "../deps.ts";
import { ingestPage } from "./ingest-page.ts";
import { reembedSourceById } from "./reembed.ts";
import { syncPagePosts } from "./sync-posts.ts";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is required to run the ingestion tests");
}

const { db, close } = createDb(url, { max: 2 });
const encryptionKey = randomBytes(32);

const runId = crypto.randomUUID().slice(0, 8);
const owner = { id: `ingest-${runId}`, name: "Ingest", email: `ing-${runId}@test.local` };
const FB_PAGE_ID = `ingest-page-${runId}`;

let pageId = "";

const PROFILE = {
  about: "Handmade cotton clothing from Dhaka",
  description: null,
  phone: "01700000000",
  address: "Mirpur, Dhaka",
  website: null,
  emails: null,
  hours: null,
};

type StubPost = {
  id: string;
  message: string | null;
  permalink: string | null;
  images: string[];
  createdTime: Date | null;
};

const POSTS: StubPost[] = [
  {
    id: "POST_1",
    message: "নতুন কটন শার্ট, দাম ১২০০ টাকা। সাইজ L, XL আছে।",
    permalink: null,
    images: ["https://img/1.jpg"],
    createdTime: new Date("2026-05-01T00:00:00Z"),
  },
  {
    id: "POST_2",
    message: "আজ দোকান বন্ধ থাকবে।",
    permalink: null,
    images: [],
    createdTime: new Date("2026-04-01T00:00:00Z"),
  },
];

function createGraphStub(posts: StubPost[] = POSTS): GraphApi {
  return {
    request: async <T>(path: string): Promise<T> => {
      if (path.endsWith("/posts")) {
        return { data: posts } as T;
      }

      return PROFILE as T;
    },
  };
}

const llm: LlmClient = {
  chat: async (messages) => {
    const prompt = messages.map((message) => message.content).join(" ");

    if (prompt.includes("১২০০")) {
      return {
        content: JSON.stringify({
          products: [
            {
              name: "Cotton Shirt",
              description: "Full sleeve cotton shirt",
              price: 1200,
              stockStatus: "in_stock",
              sizes: ["L", "XL"],
              colors: ["blue"],
              confidence: 0.9,
            },
          ],
        }),
        model: "test",
        usage: {},
      };
    }

    return { content: '{"products":[]}', model: "test", usage: {} };
  },
};

function vectorFor(text: string): number[] {
  const vector = new Array<number>(1024).fill(0);
  vector[text.length % 1024] = 1;
  return vector;
}

const embeddings: EmbeddingsClient = {
  dimensions: 1024,
  embed: async (inputs) => inputs.map(vectorFor),
  embedOne: async (text) => vectorFor(text),
};

function deps(overrides: Partial<WorkerDeps> = {}): WorkerDeps {
  return {
    db,
    graphApi: createGraphStub(),
    llm,
    embeddings,
    encryptionKey,
    ...overrides,
  };
}

beforeAll(async () => {
  await db.insert(users).values([owner]);

  const [page] = await db
    .insert(fbPages)
    .values({
      ownerId: owner.id,
      fbPageId: FB_PAGE_ID,
      name: "Ingest Test Page",
      accessTokenEncrypted: encryptToken("page-access-token", encryptionKey),
    })
    .returning();

  if (!page) {
    throw new Error("failed to insert the test page");
  }

  pageId = page.id;
});

afterAll(async () => {
  await db.delete(fbPages).where(inArray(fbPages.id, [pageId]));
  await db.delete(users).where(eq(users.id, owner.id));
  await close();
});

describe("ingestPage", () => {
  test("stores the page profile", async () => {
    await ingestPage(deps(), { pageId });

    const [profile] = await db.select().from(pageProfile).where(eq(pageProfile.pageId, pageId));

    expect(profile?.about).toBe("Handmade cotton clothing from Dhaka");
    expect(profile?.phone).toBe("01700000000");
    expect(profile?.address).toBe("Mirpur, Dhaka");
  });

  test("stores the posts from the last six months", async () => {
    const posts = await listPostsForPage(db, pageId);

    expect(posts.map((post) => post.fbPostId).sort()).toEqual(["POST_1", "POST_2"]);
  });

  test("creates extracted products as drafts", async () => {
    const products = await listProductsForPage(db, pageId);
    const extracted = products.filter((product) => product.source === "extracted");

    expect(extracted).toHaveLength(1);
    expect(extracted[0]?.name).toBe("Cotton Shirt");
    expect(extracted[0]?.status).toBe("draft");
    expect(extracted[0]?.price).toBe("1200.00");
    expect(extracted[0]?.variants).toEqual({ sizes: ["L", "XL"], colors: ["blue"] });
  });

  test("chunks and embeds the profile, the posts and the products", async () => {
    const chunks = await listChunksForPage(db, pageId);
    const sources = new Set(chunks.map((chunk) => chunk.sourceType));

    expect(sources.has("page_profile")).toBe(true);
    expect(sources.has("post")).toBe(true);
    expect(sources.has("product")).toBe(true);
  });

  test("stores a 1024 dimension embedding for every chunk", async () => {
    const rows = await db
      .select({ embedding: knowledgeChunks.embedding })
      .from(knowledgeChunks)
      .where(eq(knowledgeChunks.pageId, pageId));

    expect(rows.length).toBeGreaterThan(0);

    for (const row of rows) {
      expect(row.embedding).toHaveLength(1024);
    }
  });

  test("includes the post text in the embedded chunks", async () => {
    const chunks = await listChunksForPage(db, pageId);

    expect(chunks.some((chunk) => chunk.content.includes("১২০০"))).toBe(true);
  });

  test("describes a product with its price and sizes so it can be retrieved", async () => {
    const chunks = await listChunksForPage(db, pageId);
    const productChunk = chunks.find((chunk) => chunk.sourceType === "product");

    expect(productChunk?.content).toContain("Cotton Shirt");
    expect(productChunk?.content).toContain("1200.00");
    expect(productChunk?.content).toContain("L, XL");
  });

  test("marks the page as synced", async () => {
    const [page] = await db.select().from(fbPages).where(eq(fbPages.id, pageId));

    expect(page?.lastSyncedAt).not.toBeNull();
    expect(page?.webhookStatus).toBe("active");
  });

  test("is idempotent when it runs twice", async () => {
    const productsBefore = await listProductsForPage(db, pageId);
    const chunksBefore = await countChunksForPage(db, pageId);

    await ingestPage(deps(), { pageId });

    expect(await listProductsForPage(db, pageId)).toHaveLength(productsBefore.length);
    expect(await countChunksForPage(db, pageId)).toBe(chunksBefore);
  });

  test("reports what it ingested", async () => {
    const result = await ingestPage(deps(), { pageId });

    expect(result.pageId).toBe(pageId);
    expect(result.posts).toBe(2);
    expect(result.products).toBe(1);
    expect(result.chunks).toBeGreaterThan(0);
    expect(result.extractionFailures).toBe(0);
  });

  test("fails loudly when every extraction fails", async () => {
    const failing: LlmClient = {
      chat: async () => {
        throw new Error("model unavailable");
      },
    };

    await expect(ingestPage(deps({ llm: failing }), { pageId })).rejects.toThrow(
      /every one of the 2 product extractions failed/,
    );
  });

  test("throws for a page that no longer exists", async () => {
    await expect(
      ingestPage(deps(), { pageId: "00000000-0000-0000-0000-000000000000" }),
    ).rejects.toThrow(/no longer exists/);
  });

  test("surfaces a graph failure so the job can retry", async () => {
    const broken: GraphApi = {
      request: async () => {
        throw new Error("token expired");
      },
    };

    await expect(ingestPage(deps({ graphApi: broken }), { pageId })).rejects.toThrow(
      /token expired/,
    );
  });
});

describe("syncPagePosts", () => {
  test("refreshes the posts and their products", async () => {
    const result = await syncPagePosts(deps(), { pageId });

    expect(result.posts).toBe(2);
    expect(result.products).toBe(1);
  });

  test("drops the extracted product when its post stops selling", async () => {
    const noLongerSelling: StubPost[] = [
      {
        id: "POST_1",
        message: "ধন্যবাদ সবাইকে",
        permalink: null,
        images: [],
        createdTime: new Date("2026-05-01T00:00:00Z"),
      },
    ];

    await syncPagePosts(deps({ graphApi: createGraphStub(noLongerSelling) }), { pageId });

    const products = await listProductsForPage(db, pageId);

    expect(products.filter((product) => product.name === "Cotton Shirt")).toHaveLength(0);
  });

  test("restores the product when the post sells again", async () => {
    await syncPagePosts(deps(), { pageId });

    const products = await listProductsForPage(db, pageId);

    expect(products.filter((product) => product.name === "Cotton Shirt")).toHaveLength(1);
  });
});

describe("reembedSourceById", () => {
  test("re-embeds a post by its id", async () => {
    const [post] = await listPostsForPage(db, pageId);

    if (!post) {
      throw new Error("expected a stored post");
    }

    const result = await reembedSourceById(deps(), {
      pageId,
      sourceType: "post",
      sourceId: post.id,
    });

    expect(result.skipped).toBe(false);
    expect(result.chunks).toBeGreaterThan(0);
  });

  test("skips a source that no longer exists", async () => {
    const result = await reembedSourceById(deps(), {
      pageId,
      sourceType: "faq",
      sourceId: "00000000-0000-0000-0000-000000000000",
    });

    expect(result.skipped).toBe(true);
    expect(result.chunks).toBe(0);
  });

  test("re-embeds a product under its own source id", async () => {
    const [product] = await listProductsForPage(db, pageId);

    if (!product) {
      throw new Error("expected a stored product");
    }

    const result = await reembedSourceById(deps(), {
      pageId,
      sourceType: "product",
      sourceId: product.id,
    });

    expect(result.skipped).toBe(false);

    const chunks = await listChunksForPage(db, pageId);

    expect(chunks.some((chunk) => chunk.sourceId === product.id)).toBe(true);
  });

  test("stores chunks without vectors when no embeddings provider is configured", async () => {
    const [post] = await listPostsForPage(db, pageId);

    if (!post) {
      throw new Error("expected a stored post");
    }

    const result = await reembedSourceById(deps({ embeddings: null }), {
      pageId,
      sourceType: "post",
      sourceId: post.id,
    });

    expect(result.skipped).toBe(false);
    expect(result.chunks).toBeGreaterThan(0);

    const rows = await db
      .select({ embedding: knowledgeChunks.embedding })
      .from(knowledgeChunks)
      .where(eq(knowledgeChunks.sourceId, post.id));

    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row.embedding === null)).toBe(true);
  });

  test("backfills vectors once a provider is configured again", async () => {
    const [post] = await listPostsForPage(db, pageId);

    if (!post) {
      throw new Error("expected a stored post");
    }

    await reembedSourceById(deps(), { pageId, sourceType: "post", sourceId: post.id });

    const rows = await db
      .select({ embedding: knowledgeChunks.embedding })
      .from(knowledgeChunks)
      .where(eq(knowledgeChunks.sourceId, post.id));

    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row.embedding?.length === 1024)).toBe(true);
  });
});
