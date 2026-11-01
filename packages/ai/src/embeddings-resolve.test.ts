import { describe, expect, test } from "bun:test";
import { describeEmbeddingsProvider, resolveEmbeddingsClient } from "./embeddings-resolve.ts";
import { createStubFetch } from "./test-support/stub-fetch.ts";

function vector(): number[] {
  return new Array<number>(1024).fill(0.1);
}

describe("resolveEmbeddingsClient", () => {
  test("returns null when nothing is configured", () => {
    expect(resolveEmbeddingsClient({})).toBeNull();
    expect(
      resolveEmbeddingsClient({ workersAi: { accountId: "", apiToken: "" }, tei: {} }),
    ).toBeNull();
  });

  test("uses workers ai when the account id and token are set", () => {
    const client = resolveEmbeddingsClient({
      workersAi: { accountId: "acct-1", apiToken: "token" },
    });

    expect(client?.dimensions).toBe(1024);
  });

  test("calls the bge-m3 model by default", async () => {
    const { fetchImpl, calls } = createStubFetch([
      { body: { result: { data: [vector()] }, success: true, errors: [] } },
    ]);

    const client = resolveEmbeddingsClient({
      workersAi: { accountId: "acct-1", apiToken: "token" },
      fetchImpl,
    });

    await client?.embedOne("hi");

    expect(calls[0]?.url).toContain("/accounts/acct-1/ai/run/@cf/baai/bge-m3");
  });

  test("prefers workers ai over a self hosted server", async () => {
    const { fetchImpl, calls } = createStubFetch([
      { body: { result: { data: [vector()] }, success: true, errors: [] } },
    ]);

    const client = resolveEmbeddingsClient({
      workersAi: { accountId: "acct-1", apiToken: "token" },
      tei: { baseUrl: "http://localhost:8080" },
      fetchImpl,
    });

    await client?.embedOne("hi");

    expect(calls[0]?.url).toContain("api.cloudflare.com");
  });

  test("falls back to a self hosted server when workers ai is not set", async () => {
    const { fetchImpl, calls } = createStubFetch([{ body: [vector()] }]);

    const client = resolveEmbeddingsClient({
      workersAi: { accountId: "", apiToken: "" },
      tei: { baseUrl: "http://localhost:8080" },
      fetchImpl,
    });

    await client?.embedOne("hi");

    expect(calls[0]?.url).toBe("http://localhost:8080/embed");
  });
});

describe("describeEmbeddingsProvider", () => {
  test("names workers ai with its model", () => {
    expect(describeEmbeddingsProvider({ workersAi: { accountId: "a", apiToken: "t" } })).toBe(
      "workers-ai:@cf/baai/bge-m3",
    );
  });

  test("names a custom model", () => {
    expect(
      describeEmbeddingsProvider({
        workersAi: { accountId: "a", apiToken: "t", model: "@cf/custom" },
      }),
    ).toBe("workers-ai:@cf/custom");
  });

  test("names the self hosted server", () => {
    expect(describeEmbeddingsProvider({ tei: { baseUrl: "http://localhost:8080" } })).toBe(
      "tei:http://localhost:8080",
    );
  });

  test("says text only when nothing is configured", () => {
    expect(describeEmbeddingsProvider({})).toBe("none (text only retrieval)");
  });
});
