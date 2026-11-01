import type { FetchLike } from "../llm-types.ts";

export type StubbedResponse = {
  status?: number;
  body?: unknown;
  text?: string;
  headers?: Record<string, string>;
};

export type RecordedCall = {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
};

export function createStubFetch(responses: StubbedResponse[]) {
  const calls: RecordedCall[] = [];

  const fetchImpl: FetchLike = async (url, init) => {
    const headers = (init?.headers ?? {}) as Record<string, string>;

    calls.push({
      url,
      method: init?.method ?? "GET",
      headers,
      body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
    });

    const response = responses[Math.min(calls.length - 1, responses.length - 1)] ?? {};
    const payload =
      response.text ?? (response.body === undefined ? "" : JSON.stringify(response.body));

    return new Response(payload, {
      status: response.status ?? 200,
      headers: response.headers,
    });
  };

  return { fetchImpl, calls };
}

export function unitVector(index: number, dimensions = 1024): number[] {
  return Array.from({ length: dimensions }, (_, position) => (position === index ? 1 : 0));
}
