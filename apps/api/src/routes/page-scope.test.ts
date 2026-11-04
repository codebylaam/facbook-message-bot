import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createDb } from "@fb-bot/db";
import { fbPages, users } from "@fb-bot/db/schema";
import { eq, inArray } from "drizzle-orm";
import { resolveOptionalPageId, resolveOwnedPageId } from "./page-scope.ts";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is required to run the page scope tests");
}

const { db, close } = createDb(url, { max: 2 });

const runId = crypto.randomUUID().slice(0, 8);
const mine = { id: `scope-mine-${runId}`, name: "Mine", email: `scope-mine-${runId}@test.local` };
const theirs = {
  id: `scope-theirs-${runId}`,
  name: "Theirs",
  email: `scope-theirs-${runId}@test.local`,
};

let myPageId = "";
let theirPageId = "";

beforeAll(async () => {
  await db.insert(users).values([mine, theirs]);

  const [myPage] = await db
    .insert(fbPages)
    .values({
      ownerId: mine.id,
      fbPageId: `scope-mine-${runId}`,
      name: "My Page",
      accessTokenEncrypted: "enc",
    })
    .returning();

  const [theirPage] = await db
    .insert(fbPages)
    .values({
      ownerId: theirs.id,
      fbPageId: `scope-theirs-${runId}`,
      name: "Their Page",
      accessTokenEncrypted: "enc",
    })
    .returning();

  if (!myPage || !theirPage) {
    throw new Error("failed to insert the test pages");
  }

  myPageId = myPage.id;
  theirPageId = theirPage.id;
});

afterAll(async () => {
  await db.delete(fbPages).where(inArray(fbPages.id, [myPageId, theirPageId]));
  await db.delete(users).where(inArray(users.id, [mine.id, theirs.id]));
  await close();
});

describe("resolveOwnedPageId", () => {
  test("returns the owner's only page", async () => {
    expect(await resolveOwnedPageId(db, mine.id, undefined)).toBe(myPageId);
  });

  test("refuses a page belonging to somebody else", async () => {
    expect(resolveOwnedPageId(db, mine.id, theirPageId)).rejects.toThrow("Page not found");
  });
});

describe("resolveOptionalPageId", () => {
  test("returns null for an owner with no page, so the overview can still render", async () => {
    const stranger = `scope-none-${runId}`;
    await db
      .insert(users)
      .values([{ id: stranger, name: "None", email: `${stranger}@test.local` }]);

    expect(await resolveOptionalPageId(db, stranger, undefined)).toBeNull();

    await db.delete(users).where(eq(users.id, stranger));
  });

  test("returns the owner's page when one exists", async () => {
    expect(await resolveOptionalPageId(db, mine.id, undefined)).toBe(myPageId);
  });

  test("still refuses a page belonging to somebody else", async () => {
    expect(resolveOptionalPageId(db, mine.id, theirPageId)).rejects.toThrow("Page not found");
  });
});
