import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createDb, fbPages, knowledgeChunks, users } from "@fb-bot/db";
import { eq, inArray } from "drizzle-orm";
import { DEFAULT_RESULT_LIMIT, hybridSearch } from "./retrieval.ts";
import { unitVector } from "./test-support/stub-fetch.ts";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is required to run the retrieval tests");
}

const { db, close } = createDb(url, { max: 2 });

const runId = crypto.randomUUID().slice(0, 8);
const owner = { id: `retrieval-${runId}`, name: "Retrieval", email: `ret-${runId}@test.local` };

const OTHER_PAGE_TEXT = "a different shop delivery charge dhaka notice";

let pageId = "";
let otherPageId = "";
let vectorMatchId = "";
let textMatchId = "";
let noHitId = "";

async function addChunk(input: {
  pageId: string;
  content: string;
  embedding: number[] | null;
  sourceType?: "faq" | "product" | "policy" | "post" | "page_profile";
}) {
  const [chunk] = await db
    .insert(knowledgeChunks)
    .values({
      pageId: input.pageId,
      sourceType: input.sourceType ?? "faq",
      content: input.content,
      embedding: input.embedding,
    })
    .returning();

  if (!chunk) {
    throw new Error("failed to insert a knowledge chunk");
  }

  return chunk.id;
}

beforeAll(async () => {
  await db.insert(users).values([owner]);

  const [page] = await db
    .insert(fbPages)
    .values({
      ownerId: owner.id,
      fbPageId: `retrieval-page-${runId}`,
      name: "Retrieval Page",
      accessTokenEncrypted: "enc",
    })
    .returning();

  const [otherPage] = await db
    .insert(fbPages)
    .values({
      ownerId: owner.id,
      fbPageId: `retrieval-other-${runId}`,
      name: "Other Page",
      accessTokenEncrypted: "enc",
    })
    .returning();

  if (!page || !otherPage) {
    throw new Error("failed to insert test pages");
  }

  pageId = page.id;
  otherPageId = otherPage.id;

  vectorMatchId = await addChunk({
    pageId,
    content: "totally unrelated clothing words",
    embedding: unitVector(0),
  });

  textMatchId = await addChunk({
    pageId,
    content: "delivery charge dhaka",
    embedding: unitVector(5),
    sourceType: "policy",
  });

  noHitId = await addChunk({ pageId, content: "return policy seven days", embedding: null });

  await addChunk({
    pageId: otherPageId,
    content: OTHER_PAGE_TEXT,
    embedding: unitVector(0),
  });
});

afterAll(async () => {
  await db.delete(fbPages).where(inArray(fbPages.id, [pageId, otherPageId]));
  await db.delete(users).where(eq(users.id, owner.id));
  await close();
});

const QUERY = { pageId: "", embedding: unitVector(0), query: "delivery charge dhaka" };

describe("hybridSearch", () => {
  test("ranks a chunk that matches both the vector and the text first", async () => {
    const results = await hybridSearch(db, { ...QUERY, pageId });

    expect(results[0]?.id).toBe(textMatchId);
    expect(results[0]?.vectorRank).toBe(2);
    expect(results[0]?.textRank).toBe(1);
    expect(results[0]?.trigramRank).toBe(1);
  });

  test("fuses the vector ranking into the score", async () => {
    const results = await hybridSearch(db, { ...QUERY, pageId });

    const vectorOnly = results.find((result) => result.id === vectorMatchId);

    expect(vectorOnly?.vectorRank).toBe(1);
    expect(vectorOnly?.textRank).toBeNull();
    expect(vectorOnly?.score).toBeGreaterThan(0);
    expect(vectorOnly?.score).toBeLessThan(results[0]?.score ?? 0);
  });

  test("never returns chunks from another page", async () => {
    const results = await hybridSearch(db, { ...QUERY, pageId });

    expect(results.some((result) => result.content === OTHER_PAGE_TEXT)).toBe(false);

    const otherPageResults = await hybridSearch(db, { ...QUERY, pageId: otherPageId });

    expect(otherPageResults).toHaveLength(1);
    expect(otherPageResults[0]?.content).toBe(OTHER_PAGE_TEXT);
  });

  test("omits a chunk that matches nothing", async () => {
    const results = await hybridSearch(db, { ...QUERY, pageId });

    expect(results.some((result) => result.id === noHitId)).toBe(false);
  });

  test("returns the content and source of each hit", async () => {
    const results = await hybridSearch(db, { ...QUERY, pageId });
    const policyHit = results.find((result) => result.id === textMatchId);

    expect(policyHit?.content).toBe("delivery charge dhaka");
    expect(policyHit?.sourceType).toBe("policy");
  });

  test("honours the limit", async () => {
    const results = await hybridSearch(db, { ...QUERY, pageId, limit: 1 });

    expect(results).toHaveLength(1);
  });

  test("defaults the result limit to eight", () => {
    expect(DEFAULT_RESULT_LIMIT).toBe(8);
  });

  test("still searches by text when the vector matches nothing on this page", async () => {
    const results = await hybridSearch(db, {
      pageId,
      embedding: unitVector(900),
      query: "delivery charge dhaka",
    });

    expect(results[0]?.id).toBe(textMatchId);
  });
});
