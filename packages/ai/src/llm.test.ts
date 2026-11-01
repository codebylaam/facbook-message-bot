import { describe, expect, test } from "bun:test";
import { createLlmClient } from "./llm.ts";
import { LlmError } from "./llm-types.ts";
import { createStubFetch } from "./test-support/stub-fetch.ts";

const config = {
  apiKey: "test-key",
  baseUrl: "https://llm.test/v1",
  model: "deepseek/deepseek-v4-flash",
  maxRetries: 2,
  retryDelayMs: 0,
};

const MESSAGES = [{ role: "user" as const, content: "hello" }];

function completion(content = '{"ok":true}', extra: Record<string, unknown> = {}) {
  return {
    model: "deepseek/deepseek-v4-flash",
    choices: [{ message: { content } }],
    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    ...extra,
  };
}

describe("createLlmClient", () => {
  test("posts to the chat completions endpoint with the bearer token", async () => {
    const { fetchImpl, calls } = createStubFetch([{ body: completion() }]);

    await createLlmClient(config, fetchImpl).chat(MESSAGES);

    expect(calls[0]?.url).toBe("https://llm.test/v1/chat/completions");
    expect(calls[0]?.method).toBe("POST");
    expect(calls[0]?.headers.Authorization).toBe("Bearer test-key");
  });

  test("sends the model and messages", async () => {
    const { fetchImpl, calls } = createStubFetch([{ body: completion() }]);

    await createLlmClient(config, fetchImpl).chat(MESSAGES);

    expect(calls[0]?.body).toMatchObject({
      model: "deepseek/deepseek-v4-flash",
      messages: MESSAGES,
    });
  });

  test("returns the content, model and usage", async () => {
    const { fetchImpl } = createStubFetch([{ body: completion("the answer") }]);

    const result = await createLlmClient(config, fetchImpl).chat(MESSAGES);

    expect(result.content).toBe("the answer");
    expect(result.model).toBe("deepseek/deepseek-v4-flash");
    expect(result.usage.totalTokens).toBe(15);
  });

  test("asks for a json object when requested", async () => {
    const { fetchImpl, calls } = createStubFetch([{ body: completion() }]);

    await createLlmClient(config, fetchImpl).chat(MESSAGES, { json: true });

    expect(calls[0]?.body).toMatchObject({ response_format: { type: "json_object" } });
  });

  test("omits max_tokens when it is not set", async () => {
    const { fetchImpl, calls } = createStubFetch([{ body: completion() }]);

    await createLlmClient(config, fetchImpl).chat(MESSAGES);

    expect(calls[0]?.body).not.toHaveProperty("max_tokens");
  });

  test("retries a 429 and then succeeds", async () => {
    const { fetchImpl, calls } = createStubFetch([
      { status: 429, body: { error: "slow down" } },
      { body: completion("recovered") },
    ]);

    const result = await createLlmClient(config, fetchImpl).chat(MESSAGES);

    expect(result.content).toBe("recovered");
    expect(calls).toHaveLength(2);
  });

  test("retries a 500 and then succeeds", async () => {
    const { fetchImpl, calls } = createStubFetch([
      { status: 500, text: "boom" },
      { body: completion("recovered") },
    ]);

    await createLlmClient(config, fetchImpl).chat(MESSAGES);

    expect(calls).toHaveLength(2);
  });

  test("does not retry a 400", async () => {
    const { fetchImpl, calls } = createStubFetch([
      { status: 400, body: { error: { message: "bad request" } } },
      { body: completion() },
    ]);

    const error = await createLlmClient(config, fetchImpl)
      .chat(MESSAGES)
      .catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(LlmError);
    expect((error as LlmError).status).toBe(400);
    expect(calls).toHaveLength(1);
  });

  test("gives up after the configured retries", async () => {
    const { fetchImpl, calls } = createStubFetch([{ status: 503, text: "unavailable" }]);

    const error = await createLlmClient(config, fetchImpl)
      .chat(MESSAGES)
      .catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(LlmError);
    expect((error as LlmError).status).toBe(503);
    expect(calls).toHaveLength(3);
  });

  test("stops retrying when the server sends retry-after", async () => {
    const { fetchImpl, calls } = createStubFetch([
      { status: 429, text: "slow down", headers: { "retry-after": "0" } },
      { body: completion("after waiting") },
    ]);

    const result = await createLlmClient(config, fetchImpl).chat(MESSAGES);

    expect(result.content).toBe("after waiting");
    expect(calls).toHaveLength(2);
  });

  test("treats an empty completion as an error", async () => {
    const { fetchImpl } = createStubFetch([
      { body: { choices: [{ message: { content: "   " } }] } },
    ]);

    await expect(createLlmClient(config, fetchImpl).chat(MESSAGES)).rejects.toThrow(
      /empty completion/,
    );
  });

  test("surfaces a missing choices array", async () => {
    const { fetchImpl } = createStubFetch([{ body: { model: "x" } }]);

    await expect(createLlmClient(config, fetchImpl).chat(MESSAGES)).rejects.toThrow(
      /empty completion/,
    );
  });
});
