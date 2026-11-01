import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { randomBytes } from "node:crypto";
import type { ChatResult, LlmClient } from "@fb-bot/ai";
import { createDb, fbPages, findCommentByIdOnly, insertComment, users } from "@fb-bot/db";
import { encryptToken, type GraphApi } from "@fb-bot/meta";
import { eq, inArray } from "drizzle-orm";
import type { WorkerDeps } from "../deps.ts";
import { handleComment } from "./comment.ts";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is required to run the comment job tests");
}

const { db, close } = createDb(url, { max: 2 });
const encryptionKey = randomBytes(32);

const runId = crypto.randomUUID().slice(0, 8);
const owner = { id: `cjob-${runId}`, name: "CJob", email: `cj-${runId}@test.local` };

let pageId = "";

const REWRITE = '{"query":"shirt price","intent":"pricing","language":"banglish"}';

function answer(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    reply: "শার্টের দাম ১২০০ টাকা।",
    confidence: 0.9,
    needs_human: false,
    handoff_reason: null,
    intent: "pricing",
    source_ids: [],
    lead: null,
    ...overrides,
  });
}

/** Routes by prompt, because one comment run makes three different calls. */
function scriptedLlm(
  classification: string,
  generated = answer(),
  onPublicFail = false,
): LlmClient {
  return {
    chat: async (messages): Promise<ChatResult> => {
      const prompt = messages.map((message) => message.content).join("\n");

      if (prompt.includes("classify one Facebook post comment")) {
        return { content: classification, model: "test", usage: {} };
      }

      if (prompt.includes("search query")) {
        return { content: REWRITE, model: "test", usage: {} };
      }

      void onPublicFail;

      return { content: generated, model: "test", usage: { totalTokens: 40 } };
    },
  };
}

function graphStub(options: { failPublic?: boolean } = {}) {
  const privateReplies: string[] = [];
  const publicReplies: string[] = [];

  const api: GraphApi = {
    request: async <T>(path: string, init?: { body?: Record<string, unknown> }): Promise<T> => {
      const body = init?.body ?? {};

      if (path.endsWith("/comments")) {
        if (options.failPublic) {
          throw new Error("comment reply rejected");
        }

        publicReplies.push(String(body.message ?? ""));
        return { id: "PUBLIC_1" } as T;
      }

      const recipient = body.recipient as { comment_id?: string } | undefined;
      const message = body.message as { text?: string } | undefined;

      if (recipient?.comment_id && message?.text) {
        privateReplies.push(message.text);
      }

      return { message_id: `mid.private.${privateReplies.length}` } as T;
    },
  };

  return { api, privateReplies, publicReplies };
}

function deps(overrides: Partial<WorkerDeps> = {}): WorkerDeps {
  const stub = graphStub();

  return {
    db,
    graphApi: stub.api,
    llm: scriptedLlm('{"kind":"price_question","confidence":0.9}'),
    embeddings: null,
    encryptionKey,
    ...overrides,
  };
}

let commentId = "";

async function makeComment(text = "ei shirt er dam koto?") {
  const comment = await insertComment(db, {
    pageId,
    fbCommentId: `C_${crypto.randomUUID()}`,
    text,
  });

  if (!comment) {
    throw new Error("failed to insert a comment");
  }

  commentId = comment.id;

  return comment;
}

beforeAll(async () => {
  await db.insert(users).values([owner]);

  const [page] = await db
    .insert(fbPages)
    .values({
      ownerId: owner.id,
      fbPageId: `cjob-page-${runId}`,
      name: "CJob Page",
      accessTokenEncrypted: encryptToken("page-token", encryptionKey),
      commentMode: "private",
    })
    .returning();

  if (!page) {
    throw new Error("failed to insert the page");
  }

  pageId = page.id;
});

beforeEach(async () => {
  await db.update(fbPages).set({ commentMode: "private" }).where(eq(fbPages.id, pageId));
  await makeComment();
});

afterAll(async () => {
  await db.delete(fbPages).where(inArray(fbPages.id, [pageId]));
  await db.delete(users).where(eq(users.id, owner.id));
  await close();
});

describe("handleComment", () => {
  test("sends a private reply to a price question", async () => {
    const stub = graphStub();

    const result = await handleComment(deps({ graphApi: stub.api }), { commentId });

    expect(result.action).toBe("private_replied");
    expect(stub.privateReplies).toEqual(["শার্টের দাম ১২০০ টাকা।"]);
    expect(stub.publicReplies).toHaveLength(0);
  });

  test("records the private reply mid and the classification", async () => {
    await handleComment(deps(), { commentId });

    const comment = await findCommentByIdOnly(db, commentId);

    expect(comment?.replyStatus).toBe("private_replied");
    expect(comment?.classification).toBe("price_question");
    expect(comment?.privateReplyMid).toBe("mid.private.1");
  });

  test("also posts a public line when the page asks for it", async () => {
    await db.update(fbPages).set({ commentMode: "private_public" }).where(eq(fbPages.id, pageId));
    const stub = graphStub();

    const result = await handleComment(deps({ graphApi: stub.api }), { commentId });

    expect(result.action).toBe("public_replied");
    expect(stub.publicReplies).toHaveLength(1);
    expect(stub.publicReplies[0]).toContain("ইনবক্স");

    const comment = await findCommentByIdOnly(db, commentId);
    expect(comment?.publicReplyMid).toBe("PUBLIC_1");
  });

  test("keeps the private reply when the public one fails", async () => {
    await db.update(fbPages).set({ commentMode: "private_public" }).where(eq(fbPages.id, pageId));
    const stub = graphStub({ failPublic: true });

    const result = await handleComment(deps({ graphApi: stub.api }), { commentId });

    expect(result.action).toBe("private_replied");
    expect(stub.privateReplies).toHaveLength(1);
  });

  test("does nothing when comment replies are off", async () => {
    await db.update(fbPages).set({ commentMode: "off" }).where(eq(fbPages.id, pageId));
    const stub = graphStub();

    const result = await handleComment(deps({ graphApi: stub.api }), { commentId });

    expect(result.action).toBe("ignored");
    expect(stub.privateReplies).toHaveLength(0);
    expect((await findCommentByIdOnly(db, commentId))?.replyStatus).toBe("ignored");
  });

  test("flags a complaint instead of answering it", async () => {
    const stub = graphStub();
    const llm = scriptedLlm('{"kind":"complaint","confidence":0.88}');

    const result = await handleComment(deps({ graphApi: stub.api, llm }), { commentId });

    expect(result.action).toBe("flagged");
    expect(stub.privateReplies).toHaveLength(0);
    expect((await findCommentByIdOnly(db, commentId))?.replyStatus).toBe("flagged");
  });

  test("ignores spam", async () => {
    const llm = scriptedLlm('{"kind":"spam","confidence":0.95}');

    const result = await handleComment(deps({ llm }), { commentId });

    expect(result.action).toBe("ignored");
    expect((await findCommentByIdOnly(db, commentId))?.classification).toBe("spam");
  });

  test("ignores a comment that is not a question", async () => {
    const llm = scriptedLlm('{"kind":"other","confidence":0.6}');

    const result = await handleComment(deps({ llm }), { commentId });

    expect(result.action).toBe("ignored");
    expect(result.reason).toContain("other");
  });

  test("flags an uncertain answer instead of sending it", async () => {
    const stub = graphStub();
    const llm = scriptedLlm(
      '{"kind":"price_question","confidence":0.9}',
      answer({ confidence: 0.1 }),
    );

    const result = await handleComment(deps({ graphApi: stub.api, llm }), { commentId });

    expect(result.action).toBe("flagged");
    expect(stub.privateReplies).toHaveLength(0);
  });

  test("flags an order intent so a human can confirm it", async () => {
    const llm = scriptedLlm(
      '{"kind":"order_intent","confidence":0.9}',
      answer({
        lead: {
          name: null,
          phone: "01700000000",
          address: null,
          items: [{ name: "Cotton Shirt", quantity: 1, variant: null }],
        },
      }),
    );

    const result = await handleComment(deps({ llm }), { commentId });

    expect(result.action).toBe("flagged");
  });

  test("skips a comment that no longer exists", async () => {
    const result = await handleComment(deps(), {
      commentId: "00000000-0000-0000-0000-000000000000",
    });

    expect(result.action).toBe("skipped");
  });

  test("ignores a comment with no text", async () => {
    const empty = await makeComment("");
    await db
      .update((await import("@fb-bot/db")).comments)
      .set({ text: null })
      .where(eq((await import("@fb-bot/db")).comments.id, empty.id));

    const result = await handleComment(deps(), { commentId: empty.id });

    expect(result.action).toBe("ignored");
    expect(result.reason).toContain("no text");
  });
});
