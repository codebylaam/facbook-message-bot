import { describe, expect, test } from "bun:test";
import { EmbeddingsError } from "./embeddings.ts";
import {
  createWorkersAiEmbeddingsClient,
  DEFAULT_WORKERS_AI_MODEL,
} from "./embeddings-workers-ai.ts";
import { createStubFetch } from "./test-support/stub-fetch.ts";

const config = {
  accountId: "acct-1",
  apiToken: "cf-token",
  dimensions: 4,
  batchSize: 2,
  maxRetries: 2,
  retryDelayMs: 0,
};

const VECTOR_A = [0.1, 0.2, 0.3, 0.4];
const VECTOR_B = [0.5, 0.6, 0.7, 0.8];

function ok(data: number[][]) {
  return { body: { result: { shape: [data.length, 4], data }, success: true, errors: [] } };
}

describe("createWorkersAiEmbeddingsClient", () => {
  test("posts to the account scoped run endpoint with the bearer token", async () => {
    const { fetchImpl, calls } = createStubFetch([ok([VECTOR_A])]);

    await createWorkersAiEmbeddingsClient(config, fetchImpl).embed(["hello"]);

    expect(calls[0]?.url).toBe(
      `https://api.cloudflare.com/client/v4/accounts/acct-1/ai/run/${DEFAULT_WORKERS_AI_MODEL}`,
    );
    expect(calls[0]?.method).toBe("POST");
    expect(calls[0]?.headers.Authorization).toBe("Bearer cf-token");
  });

  test("sends the texts under a text field", async () => {
    const { fetchImpl, calls } = createStubFetch([ok([VECTOR_A])]);

    await createWorkersAiEmbeddingsClient(config, fetchImpl).embed(["hello"]);

    expect(calls[0]?.body).toEqual({ text: ["hello"] });
  });

  test("returns the vectors", async () => {
    const { fetchImpl } = createStubFetch([ok([VECTOR_A, VECTOR_B])]);

    const vectors = await createWorkersAiEmbeddingsClient(config, fetchImpl).embed(["a", "b"]);

    expect(vectors).toEqual([VECTOR_A, VECTOR_B]);
  });

  test("splits large input into batches", async () => {
    const { fetchImpl, calls } = createStubFetch([ok([VECTOR_A, VECTOR_B]), ok([VECTOR_A])]);

    const vectors = await createWorkersAiEmbeddingsClient(config, fetchImpl).embed(["a", "b", "c"]);

    expect(calls).toHaveLength(2);
    expect(calls[0]?.body).toEqual({ text: ["a", "b"] });
    expect(calls[1]?.body).toEqual({ text: ["c"] });
    expect(vectors).toHaveLength(3);
  });

  test("embedOne returns one vector", async () => {
    const { fetchImpl } = createStubFetch([ok([VECTOR_A])]);

    expect(await createWorkersAiEmbeddingsClient(config, fetchImpl).embedOne("hi")).toEqual(
      VECTOR_A,
    );
  });

  test("honours a custom model", async () => {
    const { fetchImpl, calls } = createStubFetch([ok([VECTOR_A])]);

    await createWorkersAiEmbeddingsClient(
      { ...config, model: "@cf/baai/bge-small-en-v1.5" },
      fetchImpl,
    ).embed(["hi"]);

    expect(calls[0]?.url).toContain("@cf/baai/bge-small-en-v1.5");
  });

  test("rejects a vector of the wrong width", async () => {
    const { fetchImpl } = createStubFetch([ok([[0.1, 0.2]])]);

    await expect(createWorkersAiEmbeddingsClient(config, fetchImpl).embed(["hi"])).rejects.toThrow(
      /expected 4/,
    );
  });

  test("rejects a payload with the wrong number of vectors", async () => {
    const { fetchImpl } = createStubFetch([ok([VECTOR_A])]);

    await expect(
      createWorkersAiEmbeddingsClient(config, fetchImpl).embed(["a", "b"]),
    ).rejects.toThrow(/1 vectors for 2 inputs/);
  });

  test("surfaces the cloudflare error message", async () => {
    const { fetchImpl } = createStubFetch([
      {
        status: 400,
        body: { success: false, errors: [{ code: 1000, message: "Invalid model" }], result: null },
      },
    ]);

    const error = await createWorkersAiEmbeddingsClient(config, fetchImpl)
      .embed(["hi"])
      .catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(EmbeddingsError);
    expect((error as EmbeddingsError).message).toContain("Invalid model");
    expect((error as EmbeddingsError).status).toBe(400);
  });

  test("retries a 429 and then succeeds", async () => {
    const { fetchImpl, calls } = createStubFetch([
      { status: 429, body: { success: false, errors: [{ message: "rate limited" }] } },
      ok([VECTOR_A]),
    ]);

    const vectors = await createWorkersAiEmbeddingsClient(config, fetchImpl).embed(["hi"]);

    expect(vectors).toEqual([VECTOR_A]);
    expect(calls).toHaveLength(2);
  });

  test("gives up after the configured retries", async () => {
    const { fetchImpl, calls } = createStubFetch([
      { status: 503, body: { success: false, errors: [{ message: "unavailable" }] } },
    ]);

    await expect(createWorkersAiEmbeddingsClient(config, fetchImpl).embed(["hi"])).rejects.toThrow(
      /unavailable/,
    );
    expect(calls).toHaveLength(3);
  });

  test("does not retry a 400", async () => {
    const { fetchImpl, calls } = createStubFetch([
      { status: 400, body: { success: false, errors: [{ message: "bad input" }] } },
      ok([VECTOR_A]),
    ]);

    await expect(
      createWorkersAiEmbeddingsClient(config, fetchImpl).embed(["hi"]),
    ).rejects.toThrow();
    expect(calls).toHaveLength(1);
  });

  test("treats a success false body as an error", async () => {
    const { fetchImpl } = createStubFetch([
      { status: 200, body: { success: false, errors: [{ message: "model not available" }] } },
    ]);

    await expect(createWorkersAiEmbeddingsClient(config, fetchImpl).embed(["hi"])).rejects.toThrow(
      /model not available/,
    );
  });

  test("reports the configured dimensions", () => {
    const { fetchImpl } = createStubFetch([ok([VECTOR_A])]);

    expect(createWorkersAiEmbeddingsClient(config, fetchImpl).dimensions).toBe(4);
  });
});
