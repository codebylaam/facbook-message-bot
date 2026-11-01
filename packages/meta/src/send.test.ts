import { describe, expect, test } from "bun:test";
import type { MetaConfig } from "./config.ts";
import { createGraphApi } from "./graph.ts";
import {
  extractSharedPostUrl,
  replyToComment,
  sendPrivateReply,
  sendSenderAction,
  sendTextMessage,
  showTypingThenWait,
} from "./send.ts";
import { createStubFetch } from "./test-support/stub-fetch.ts";

const config: MetaConfig = {
  appId: "a",
  appSecret: "s",
  verifyToken: "v",
  graphVersion: "v23.0",
  graphBaseUrl: "https://graph.test",
};

const TARGET = { pageId: "PAGE_1", pageAccessToken: "page-token", recipientId: "PSID_1" };

type RecordedCall = { body: string | undefined };

function bodyOf(call: RecordedCall | undefined): unknown {
  return JSON.parse(String(call?.body ?? "null"));
}

describe("sendTextMessage", () => {
  test("posts a response message to the page", async () => {
    const { fetchImpl, calls } = createStubFetch([
      { body: { message_id: "m_1", recipient_id: "PSID_1" } },
    ]);

    const result = await sendTextMessage(createGraphApi(config, fetchImpl), {
      ...TARGET,
      text: "দাম ১২০০ টাকা।",
    });

    expect(calls[0]?.url).toContain("/v23.0/PAGE_1/messages");
    expect(calls[0]?.method).toBe("POST");
    expect(bodyOf(calls[0])).toEqual({
      messaging_type: "RESPONSE",
      recipient: { id: "PSID_1" },
      message: { text: "দাম ১২০০ টাকা।" },
    });
    expect(result.messageId).toBe("m_1");
  });

  test("falls back to the recipient when facebook omits it", async () => {
    const { fetchImpl } = createStubFetch([{ body: { message_id: "m_1" } }]);

    const result = await sendTextMessage(createGraphApi(config, fetchImpl), {
      ...TARGET,
      text: "hi",
    });

    expect(result.recipientId).toBe("PSID_1");
  });

  test("reports a null message id when facebook returns none", async () => {
    const { fetchImpl } = createStubFetch([{ body: {} }]);

    const result = await sendTextMessage(createGraphApi(config, fetchImpl), {
      ...TARGET,
      text: "hi",
    });

    expect(result.messageId).toBeNull();
  });
});

describe("sendSenderAction", () => {
  test("sends the action instead of a message", async () => {
    const { fetchImpl, calls } = createStubFetch([{ body: {} }]);

    await sendSenderAction(createGraphApi(config, fetchImpl), {
      ...TARGET,
      action: "typing_on",
    });

    expect(bodyOf(calls[0])).toEqual({
      recipient: { id: "PSID_1" },
      sender_action: "typing_on",
    });
  });
});

describe("showTypingThenWait", () => {
  test("marks seen, types, waits, then stops typing", async () => {
    const callOrder: string[] = [];
    const started = Date.now();

    const fetchImpl = async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}"));
      callOrder.push(body.sender_action);
      return new Response("{}", { status: 200 });
    };

    await showTypingThenWait(createGraphApi(config, fetchImpl), TARGET, { delayMs: 20 });

    expect(callOrder).toEqual(["mark_seen", "typing_on", "typing_off"]);
    expect(Date.now() - started).toBeGreaterThanOrEqual(15);
  });

  test("waits at least zero even for a negative delay", async () => {
    const { fetchImpl, calls } = createStubFetch([{ body: {} }]);

    await showTypingThenWait(createGraphApi(config, fetchImpl), TARGET, { delayMs: -50 });

    expect(calls).toHaveLength(3);
  });
});

describe("extractSharedPostUrl", () => {
  test("finds a post link", () => {
    expect(
      extractSharedPostUrl("ei post ta dekhen https://www.facebook.com/dhakathreads/posts/123456"),
    ).toBe("https://www.facebook.com/dhakathreads/posts/123456");
  });

  test("finds a reel link", () => {
    expect(extractSharedPostUrl("https://facebook.com/shop/videos/99")).toBe(
      "https://facebook.com/shop/videos/99",
    );
  });

  test("returns null when there is no link", () => {
    expect(extractSharedPostUrl("shirt er dam koto?")).toBeNull();
    expect(extractSharedPostUrl(null)).toBeNull();
  });

  test("ignores a non post facebook link", () => {
    expect(extractSharedPostUrl("https://facebook.com/dhakathreads")).toBeNull();
  });
});

describe("sendPrivateReply", () => {
  test("addresses the comment instead of a person", async () => {
    const { fetchImpl, calls } = createStubFetch([{ body: { message_id: "mid.private.1" } }]);

    const result = await sendPrivateReply(createGraphApi(config, fetchImpl), {
      pageId: "PAGE_1",
      pageAccessToken: "t",
      commentId: "COMMENT_1",
      text: "দাম ১২০০ টাকা।",
    });

    expect(calls[0]?.url).toContain("/v23.0/PAGE_1/messages");
    expect(bodyOf(calls[0])).toEqual({
      messaging_type: "RESPONSE",
      recipient: { comment_id: "COMMENT_1" },
      message: { text: "দাম ১২০০ টাকা।" },
    });
    expect(result.messageId).toBe("mid.private.1");
  });

  test("reports a null id when facebook returns none", async () => {
    const { fetchImpl } = createStubFetch([{ body: {} }]);

    const result = await sendPrivateReply(createGraphApi(config, fetchImpl), {
      pageId: "PAGE_1",
      pageAccessToken: "t",
      commentId: "COMMENT_1",
      text: "hi",
    });

    expect(result.messageId).toBeNull();
  });
});

describe("replyToComment", () => {
  test("posts a public reply on the comment", async () => {
    const { fetchImpl, calls } = createStubFetch([{ body: { id: "COMMENT_REPLY_1" } }]);

    const result = await replyToComment(createGraphApi(config, fetchImpl), {
      commentId: "COMMENT_1",
      pageAccessToken: "t",
      message: "ইনবক্সে বিস্তারিত দেওয়া হয়েছে",
    });

    expect(calls[0]?.url).toContain("/COMMENT_1/comments");
    expect(bodyOf(calls[0])).toEqual({ message: "ইনবক্সে বিস্তারিত দেওয়া হয়েছে" });
    expect(result.commentId).toBe("COMMENT_REPLY_1");
  });
});
