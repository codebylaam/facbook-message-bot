import type { MetaConfig } from "./config.ts";
import { graphBaseUrl } from "./config.ts";
import { GraphApiError, type GraphErrorBody } from "./errors.ts";

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export type GraphRequestOptions = {
  method?: "GET" | "POST" | "DELETE";
  accessToken?: string;
  params?: Record<string, string | number | boolean | undefined>;
  body?: Record<string, unknown>;
};

export type GraphApi = {
  request: <T>(path: string, options?: GraphRequestOptions) => Promise<T>;
};

function parseJson(text: string): unknown {
  if (text.length === 0) {
    return undefined;
  }

  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

export function createGraphApi(config: MetaConfig, fetchImpl: FetchLike = fetch): GraphApi {
  const baseUrl = graphBaseUrl(config);

  async function request<T>(path: string, options: GraphRequestOptions = {}): Promise<T> {
    const url = new URL(`${baseUrl}${path}`);

    for (const [key, value] of Object.entries(options.params ?? {})) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }

    if (options.accessToken) {
      url.searchParams.set("access_token", options.accessToken);
    }

    const response = await fetchImpl(url.toString(), {
      method: options.method ?? "GET",
      headers: options.body ? { "Content-Type": "application/json" } : undefined,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const parsed = parseJson(await response.text());

    if (!response.ok) {
      const errorBody = parsed as GraphErrorBody | undefined;
      throw new GraphApiError(
        errorBody?.error?.message ?? `Graph API responded with ${response.status}`,
        {
          status: response.status,
          code: errorBody?.error?.code,
          subcode: errorBody?.error?.error_subcode,
          body: parsed,
        },
      );
    }

    return parsed as T;
  }

  return { request };
}
