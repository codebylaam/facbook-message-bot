import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { inArray } from "drizzle-orm";
import { createDb } from "../client.ts";
import { users } from "../schema/auth.ts";
import {
  createPageForOwner,
  deletePageForOwner,
  findPageForOwner,
  listPagesForOwner,
  updatePageForOwner,
} from "./pages.ts";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is required to run the repository tests");
}

const { db, close } = createDb(url, { max: 2 });

const runId = crypto.randomUUID().slice(0, 8);

const ownerA = { id: `test-a-${runId}`, name: "Owner A", email: `a-${runId}@test.local` };
const ownerB = { id: `test-b-${runId}`, name: "Owner B", email: `b-${runId}@test.local` };

let pageSequence = 0;

async function givenPageForOwner(ownerId: string) {
  pageSequence += 1;
  const page = await createPageForOwner(db, ownerId, {
    fbPageId: `fb-${ownerId}-${runId}-${pageSequence}`,
    name: `Page ${pageSequence}`,
    accessTokenEncrypted: "encrypted-token",
  });

  if (!page) {
    throw new Error("failed to insert test page");
  }

  return page;
}

function pagesForOwnerInThisRun(ownerId: string) {
  return listPagesForOwner(db, ownerId).then((pages) =>
    pages.filter((page) => page.fbPageId.includes(runId)),
  );
}

beforeAll(async () => {
  await db.insert(users).values([ownerA, ownerB]);
});

afterAll(async () => {
  await db.delete(users).where(inArray(users.id, [ownerA.id, ownerB.id]));
  await close();
});

describe("page repository tenancy", () => {
  test("lists only the pages belonging to the owner", async () => {
    const pageA = await givenPageForOwner(ownerA.id);
    const pageB = await givenPageForOwner(ownerB.id);

    const aPages = await pagesForOwnerInThisRun(ownerA.id);
    const bPages = await pagesForOwnerInThisRun(ownerB.id);

    expect(aPages.map((page) => page.id)).toContain(pageA.id);
    expect(aPages.map((page) => page.id)).not.toContain(pageB.id);
    expect(bPages.map((page) => page.id)).toContain(pageB.id);
    expect(bPages.map((page) => page.id)).not.toContain(pageA.id);
  });

  test("cannot read another owner's page by id", async () => {
    const pageA = await givenPageForOwner(ownerA.id);

    expect(await findPageForOwner(db, ownerA.id, pageA.id)).toBeDefined();
    expect(await findPageForOwner(db, ownerB.id, pageA.id)).toBeUndefined();
  });

  test("cannot update another owner's page", async () => {
    const pageA = await givenPageForOwner(ownerA.id);

    const updated = await updatePageForOwner(db, ownerB.id, pageA.id, { botEnabled: false });

    expect(updated).toHaveLength(0);
    expect((await findPageForOwner(db, ownerA.id, pageA.id))?.botEnabled).toBe(true);
  });

  test("cannot delete another owner's page", async () => {
    const pageA = await givenPageForOwner(ownerA.id);

    const deleted = await deletePageForOwner(db, ownerB.id, pageA.id);

    expect(deleted).toHaveLength(0);
    expect(await findPageForOwner(db, ownerA.id, pageA.id)).toBeDefined();
  });

  test("updates and deletes its own page", async () => {
    const pageA = await givenPageForOwner(ownerA.id);

    const updated = await updatePageForOwner(db, ownerA.id, pageA.id, { botEnabled: false });
    expect(updated).toHaveLength(1);
    expect(updated[0]?.botEnabled).toBe(false);

    const deleted = await deletePageForOwner(db, ownerA.id, pageA.id);
    expect(deleted).toHaveLength(1);
    expect(await findPageForOwner(db, ownerA.id, pageA.id)).toBeUndefined();
  });
});
