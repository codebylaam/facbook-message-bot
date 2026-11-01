import { describe, expect, test } from "bun:test";
import type { MetaConfig } from "./config.ts";
import { describeGraphError, GraphApiError, isTokenInvalidError } from "./errors.ts";
import { createGraphApi } from "./graph.ts";
import { createStubFetch } from "./test-support/stub-fetch.ts";

const config: MetaConfig = {
  appId: "app-1",
  appSecret: "secret-1",
  verifyToken: "verify-1",
  graphVersion: "v23.0",
  graphBaseUrl: "https://graph.test",
};

describe("createGraphApi", () => {
  test("builds the versioned url", async () => {
    const { fetchImpl, calls } = createStubFetch([{ body: { ok: true } }]);

    await createGraphApi(config, fetchImpl).request("/me/accounts");

    expect(calls[0]?.url).toStartWith("https://graph.test/v23.0/me/accounts");
  });

  test("returns the parsed body", async () => {
    const { fetchImpl } = createStubFetch([{ body: { id: "PAGE_1" } }]);

    await expect(createGraphApi(config, fetchImpl).request("/PAGE_1")).resolves.toEqual({
      id: "PAGE_1",
    });
  });

  test("passes params and the access token", async () => {
    const { fetchImpl, searchParams } = createStubFetch([{ body: {} }]);

    await createGraphApi(config, fetchImpl).request("/me/accounts", {
      accessToken: "token-abc",
      params: { fields: "id,name", limit: 25 },
    });

    expect(searchParams(0).get("access_token")).toBe("token-abc");
    expect(searchParams(0).get("fields")).toBe("id,name");
    expect(searchParams(0).get("limit")).toBe("25");
  });

  test("drops undefined params", async () => {
    const { fetchImpl, searchParams } = createStubFetch([{ body: {} }]);

    await createGraphApi(config, fetchImpl).request("/me", { params: { fields: undefined } });

    expect(searchParams(0).has("fields")).toBe(false);
  });

  test("posts a json body", async () => {
    const { fetchImpl, calls } = createStubFetch([{ body: { success: true } }]);

    await createGraphApi(config, fetchImpl).request("/PAGE_1/subscribed_apps", {
      method: "POST",
      body: { subscribed_fields: "messages" },
    });

    expect(calls[0]?.method).toBe("POST");
    expect(calls[0]?.body).toBe(JSON.stringify({ subscribed_fields: "messages" }));
  });

  test("maps a graph error to GraphApiError", async () => {
    const { fetchImpl } = createStubFetch([
      {
        status: 400,
        body: {
          error: {
            message: "Invalid OAuth access token",
            type: "OAuthException",
            code: 190,
            error_subcode: 463,
          },
        },
      },
    ]);

    const error = await createGraphApi(config, fetchImpl)
      .request("/me")
      .catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(GraphApiError);
    expect((error as GraphApiError).message).toBe("Invalid OAuth access token");
    expect((error as GraphApiError).status).toBe(400);
    expect((error as GraphApiError).code).toBe(190);
    expect((error as GraphApiError).subcode).toBe(463);
    expect(isTokenInvalidError(error)).toBe(true);
  });

  test("maps a non-json error body", async () => {
    const { fetchImpl } = createStubFetch([{ status: 500, text: "<html>oops</html>" }]);

    const error = await createGraphApi(config, fetchImpl)
      .request("/me")
      .catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(GraphApiError);
    expect((error as GraphApiError).status).toBe(500);
    expect((error as GraphApiError).code).toBeUndefined();
    expect(isTokenInvalidError(error)).toBe(false);
  });

  test("returns undefined for an empty success body", async () => {
    const { fetchImpl } = createStubFetch([{ status: 200, text: "" }]);

    await expect(createGraphApi(config, fetchImpl).request("/me")).resolves.toBeUndefined();
  });
});

describe("describeGraphError", () => {
  test("uses the graph message", () => {
    const error = new GraphApiError("Token expired", { status: 400, body: {} });

    expect(describeGraphError(error)).toBe("Token expired");
  });

  test("falls back for unknown errors", () => {
    expect(describeGraphError("nope")).toBe("The Facebook Graph API request failed");
  });
});
