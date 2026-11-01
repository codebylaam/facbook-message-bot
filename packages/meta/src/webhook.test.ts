import { describe, expect, test } from "bun:test";
import {
  classifyEntry,
  computeSignature,
  parseWebhookPayload,
  verifySignature,
  webhookPayloadSchema,
} from "./webhook.ts";

const APP_SECRET = "app-secret-value";

const MESSAGE_PAYLOAD = {
  object: "page",
  entry: [
    {
      id: "PAGE_1",
      time: 1_700_000_000,
      messaging: [
        {
          sender: { id: "PSID_1" },
          recipient: { id: "PAGE_1" },
          timestamp: 1_700_000_000,
          message: { mid: "mid.1", text: "shirt er dam koto?" },
        },
      ],
    },
  ],
};

const FEED_PAYLOAD = {
  object: "page",
  entry: [
    {
      id: "PAGE_1",
      time: 1_700_000_001,
      changes: [
        {
          field: "feed",
          value: {
            item: "comment",
            verb: "add",
            comment_id: "COMMENT_1",
            post_id: "POST_1",
            message: "price?",
          },
        },
      ],
    },
  ],
};

describe("signature verification", () => {
  test("accepts a signature it produced", () => {
    const rawBody = JSON.stringify(MESSAGE_PAYLOAD);
    const signature = computeSignature(rawBody, APP_SECRET);

    expect(verifySignature({ rawBody, appSecret: APP_SECRET, signature })).toBe(true);
  });

  test("rejects a signature from a different secret", () => {
    const rawBody = JSON.stringify(MESSAGE_PAYLOAD);
    const signature = computeSignature(rawBody, "another-secret");

    expect(verifySignature({ rawBody, appSecret: APP_SECRET, signature })).toBe(false);
  });

  test("rejects a body that changed after signing", () => {
    const signature = computeSignature(JSON.stringify(MESSAGE_PAYLOAD), APP_SECRET);

    expect(
      verifySignature({
        rawBody: JSON.stringify({ ...MESSAGE_PAYLOAD, object: "instagram" }),
        appSecret: APP_SECRET,
        signature,
      }),
    ).toBe(false);
  });

  test("rejects a missing signature", () => {
    expect(verifySignature({ rawBody: "{}", appSecret: APP_SECRET, signature: undefined })).toBe(
      false,
    );
  });

  test("rejects an empty signature without throwing", () => {
    expect(verifySignature({ rawBody: "{}", appSecret: APP_SECRET, signature: "" })).toBe(false);
  });

  test("rejects a signature of the wrong length without throwing", () => {
    expect(
      verifySignature({ rawBody: "{}", appSecret: APP_SECRET, signature: "sha256=abcd" }),
    ).toBe(false);
  });

  test("produces the documented header format", () => {
    expect(computeSignature("{}", APP_SECRET)).toMatch(/^sha256=[0-9a-f]{64}$/);
  });
});

describe("webhook payload parsing", () => {
  test("parses a message entry", () => {
    const [entry] = parseWebhookPayload(JSON.stringify(MESSAGE_PAYLOAD));

    expect(entry?.fbPageId).toBe("PAGE_1");
    expect(entry?.object).toBe("page");
    expect(entry?.field).toBe("messages");
  });

  test("parses a feed entry", () => {
    const [entry] = parseWebhookPayload(JSON.stringify(FEED_PAYLOAD));

    expect(entry?.fbPageId).toBe("PAGE_1");
    expect(entry?.field).toBe("feed");
  });

  test("handles several entries at once", () => {
    const entries = parseWebhookPayload(
      JSON.stringify({
        object: "page",
        entry: [MESSAGE_PAYLOAD.entry[0], FEED_PAYLOAD.entry[0]],
      }),
    );

    expect(entries.map((entry) => entry.field)).toEqual(["messages", "feed"]);
  });

  test("keeps unknown fields on an entry", () => {
    const entries = parseWebhookPayload(
      JSON.stringify({
        object: "page",
        entry: [{ id: "PAGE_1", standby: [{ sender: { id: "PSID_9" } }] }],
      }),
    );

    expect(entries[0]?.entry).toHaveProperty("standby");
    expect(entries[0]?.field).toBe("unknown");
  });

  test("tolerates an echo message without text", () => {
    const entries = parseWebhookPayload(
      JSON.stringify({
        object: "page",
        entry: [
          {
            id: "PAGE_1",
            messaging: [
              {
                sender: { id: "PAGE_1" },
                recipient: { id: "PSID_1" },
                message: { mid: "mid.2", is_echo: true },
              },
            ],
          },
        ],
      }),
    );

    expect(entries[0]?.field).toBe("messages");
  });

  test("rejects a payload with no entries array", () => {
    expect(() => parseWebhookPayload(JSON.stringify({ object: "page" }))).toThrow();
  });

  test("rejects an entry without an id", () => {
    expect(() =>
      parseWebhookPayload(JSON.stringify({ object: "page", entry: [{ time: 1 }] })),
    ).toThrow();
  });

  test("rejects a non-json body", () => {
    expect(() => parseWebhookPayload("not json")).toThrow();
  });
});

function firstEntry(entry: unknown) {
  const parsed = webhookPayloadSchema.parse({ object: "page", entry: [entry] });
  const [first] = parsed.entry;

  if (!first) {
    throw new Error("expected the payload to contain one entry");
  }

  return first;
}

describe("classifyEntry", () => {
  test("treats an empty entry as unknown", () => {
    expect(classifyEntry(firstEntry({ id: "PAGE_1" }))).toBe("unknown");
  });

  test("ignores an entry with an empty messaging array", () => {
    expect(classifyEntry(firstEntry({ id: "PAGE_1", messaging: [] }))).toBe("unknown");
  });

  test("prefers messages over changes", () => {
    const entry = firstEntry({
      id: "PAGE_1",
      messaging: [{ sender: { id: "A" }, recipient: { id: "B" } }],
      changes: [{ field: "feed", value: {} }],
    });

    expect(classifyEntry(entry)).toBe("messages");
  });

  test("classifies a feed change as feed", () => {
    const entry = firstEntry({
      id: "PAGE_1",
      changes: [{ field: "feed", value: { item: "comment" } }],
    });

    expect(classifyEntry(entry)).toBe("feed");
  });
});
