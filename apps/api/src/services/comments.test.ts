import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createDb, customers, fbPages, findCommentByFbId, posts, users } from "@fb-bot/db";
import type { WebhookEntry } from "@fb-bot/meta";
import { eq, inArray } from "drizzle-orm";
import { handleFeedEntry } from "./comments.ts";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is required to run the feed tests");
}

const { db, close } = createDb(url, { max: 2 });

const runId = crypto.randomUUID().slice(0, 8);
const owner = { id: `feed-${runId}`, name: "Feed", email: `fd-${runId}@test.local` };
const FB_PAGE_ID = `feed-page-${runId}`;
const FB_POST_ID = `feed-post-${runId}`;

let pageId = "";
const enqueued: string[] = [];

const deps = () => ({
  db,
  enqueueComment: async (commentId: string) => {
    enqueued.push(commentId);
  },
});

function feedEntry(overrides: { commentId?: string; verb?: string; item?: string } = {}) {
  return {
    id: FB_PAGE_ID,
    changes: [
      {
        field: "feed",
        value: {
          item: overrides.item ?? "comment",
          verb: overrides.verb ?? "add",
          comment_id: overrides.commentId ?? "COMMENT_1",
          post_id: FB_POST_ID,
          message: "ei shirt er dam koto?",
          from: { id: `PSID_${runId}`, name: "Karim" },
        },
      },
    ],
  } as WebhookEntry;
}

beforeAll(async () => {
  await db.insert(users).values([owner]);

  const [page] = await db
    .insert(fbPages)
    .values({
      ownerId: owner.id,
      fbPageId: FB_PAGE_ID,
      name: "Feed Page",
      accessTokenEncrypted: "enc",
    })
    .returning();

  if (!page) {
    throw new Error("failed to insert the page");
  }

  pageId = page.id;

  await db.insert(posts).values({
    pageId,
    fbPostId: FB_POST_ID,
    message: "Cotton Shirt. Price 1200 BDT.",
    images: [],
  });
});

afterAll(async () => {
  await db.delete(fbPages).where(inArray(fbPages.id, [pageId]));
  await db.delete(users).where(eq(users.id, owner.id));
  await close();
});

describe("handleFeedEntry", () => {
  test("stores a new comment and enqueues it", async () => {
    enqueued.length = 0;

    const result = await handleFeedEntry(deps(), feedEntry());

    expect(result.stored).toBe(1);
    expect(result.enqueued).toBe(1);
    expect(enqueued).toHaveLength(1);
  });

  test("links the comment to its post and its author", async () => {
    const comment = await findCommentByFbId(db, "COMMENT_1");

    expect(comment?.postId).not.toBeNull();

    const [customer] = await db
      .select()
      .from(customers)
      .where(eq(customers.pageId, pageId))
      .limit(1);

    expect(customer?.psid).toBe(`PSID_${runId}`);
    expect(customer?.name).toBe("Karim");
    expect(comment?.customerId).toBe(customer?.id);
  });

  test("drops a duplicate delivery", async () => {
    enqueued.length = 0;

    const result = await handleFeedEntry(deps(), feedEntry());

    expect(result.duplicates).toBe(1);
    expect(result.stored).toBe(0);
    expect(enqueued).toHaveLength(0);
  });

  test("ignores a like or a removal", async () => {
    const like = await handleFeedEntry(deps(), feedEntry({ item: "like", commentId: "C_LIKE" }));
    const removal = await handleFeedEntry(deps(), feedEntry({ verb: "remove", commentId: "C_RM" }));

    expect(like.skipped).toBe(1);
    expect(like.stored).toBe(0);
    expect(removal.skipped).toBe(1);
  });

  test("ignores a page that is not connected", async () => {
    const result = await handleFeedEntry(deps(), {
      id: "UNKNOWN_PAGE",
      changes: [
        {
          field: "feed",
          value: { item: "comment", verb: "add", comment_id: "C_UNKNOWN", message: "hi" },
        },
      ],
    } as WebhookEntry);

    expect(result.skipped).toBe(1);
    expect(result.reason).toContain("not connected");
  });

  test("stores a comment even when the post is unknown", async () => {
    enqueued.length = 0;

    const result = await handleFeedEntry(deps(), {
      id: FB_PAGE_ID,
      changes: [
        {
          field: "feed",
          value: {
            item: "comment",
            verb: "add",
            comment_id: "C_NO_POST",
            post_id: "UNKNOWN_POST",
            message: "dam koto?",
            from: { id: `PSID_${runId}`, name: "Karim" },
          },
        },
      ],
    } as WebhookEntry);

    expect(result.stored).toBe(1);

    const comment = await findCommentByFbId(db, "C_NO_POST");
    expect(comment?.postId).toBeNull();
  });
});
