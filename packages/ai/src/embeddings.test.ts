import { describe, expect, test } from "bun:test";
import { createEmbeddingsClient, EmbeddingsError, pingEmbeddings } from "./embeddings.ts";
import { createStubFetch } from "./test-support/stub-fetch.ts";

const config = { baseUrl: "https://embed.test", dimensions: 4, batchSize: 2 };

const VECTOR_A = [0.1, 0.2, 0.3, 0.4];
const VECTOR_B = [0.5, 0.6, 0.7, 0.8];

describe("createEmbeddingsClient", () => {
  test("posts to the embed endpoint", async () => {
    const { fetchImpl, calls } = createStubFetch([{ body: [VECTOR_A] }]);

    await createEmbeddingsClient(config, fetchImpl).embed(["hello"]);

    expect(calls[0]?.url).toBe("https://embed.test/embed");
    expect(calls[0]?.method).toBe("POST");
    expect(calls[0]?.body).toMatchObject({ inputs: ["hello"], truncate: true, normalize: true });
  });

  test("returns the vectors", async () => {
    const { fetchImpl } = createStubFetch([{ body: [VECTOR_A, VECTOR_B] }]);

    const vectors = await createEmbeddingsClient(config, fetchImpl).embed(["a", "b"]);

    expect(vectors).toEqual([VECTOR_A, VECTOR_B]);
  });

  test("returns nothing for no input", async () => {
    const { fetchImpl, calls } = createStubFetch([{ body: [] }]);

    expect(await createEmbeddingsClient(config, fetchImpl).embed([])).toEqual([]);
    expect(calls).toHaveLength(0);
  });

  test("splits large input into batches", async () => {
    const { fetchImpl, calls } = createStubFetch([
      { body: [VECTOR_A, VECTOR_B] },
      { body: [VECTOR_A] },
    ]);

    const vectors = await createEmbeddingsClient(config, fetchImpl).embed(["a", "b", "c"]);

    expect(calls).toHaveLength(2);
    expect(calls[0]?.body).toMatchObject({ inputs: ["a", "b"] });
    expect(calls[1]?.body).toMatchObject({ inputs: ["c"] });
    expect(vectors).toHaveLength(3);
  });

  test("embedOne returns a single vector", async () => {
    const { fetchImpl } = createStubFetch([{ body: [VECTOR_A] }]);

    expect(await createEmbeddingsClient(config, fetchImpl).embedOne("hello")).toEqual(VECTOR_A);
  });

  test("rejects a vector with the wrong number of dimensions", async () => {
    const { fetchImpl } = createStubFetch([{ body: [[0.1, 0.2]] }]);

    const error = await createEmbeddingsClient(config, fetchImpl)
      .embed(["hello"])
      .catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(EmbeddingsError);
    expect((error as EmbeddingsError).message).toContain("expected 4");
  });

  test("rejects a payload with the wrong number of vectors", async () => {
    const { fetchImpl } = createStubFetch([{ body: [VECTOR_A] }]);

    await expect(createEmbeddingsClient(config, fetchImpl).embed(["a", "b"])).rejects.toThrow(
      /1 vectors for 2 inputs/,
    );
  });

  test("throws with the status on a failed request", async () => {
    const { fetchImpl } = createStubFetch([{ status: 503, text: "model loading" }]);

    const error = await createEmbeddingsClient(config, fetchImpl)
      .embed(["hello"])
      .catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(EmbeddingsError);
    expect((error as EmbeddingsError).status).toBe(503);
    expect((error as EmbeddingsError).message).toContain("model loading");
  });

  test("strips a trailing slash from the base url", async () => {
    const { fetchImpl, calls } = createStubFetch([{ body: [VECTOR_A] }]);

    await createEmbeddingsClient({ ...config, baseUrl: "https://embed.test/" }, fetchImpl).embed([
      "hello",
    ]);

    expect(calls[0]?.url).toBe("https://embed.test/embed");
  });

  test("exposes the configured dimensions", () => {
    const { fetchImpl } = createStubFetch([{ body: [] }]);

    expect(createEmbeddingsClient(config, fetchImpl).dimensions).toBe(4);
  });
});

describe("pingEmbeddings", () => {
  test("reports healthy when the service answers", async () => {
    const { fetchImpl, calls } = createStubFetch([{ status: 200, text: "ok" }]);

    expect(await pingEmbeddings(config, fetchImpl)).toBe(true);
    expect(calls[0]?.url).toBe("https://embed.test/health");
  });

  test("reports unhealthy when the service is down", async () => {
    const { fetchImpl } = createStubFetch([{ status: 503, text: "loading" }]);

    expect(await pingEmbeddings(config, fetchImpl)).toBe(false);
  });
});
