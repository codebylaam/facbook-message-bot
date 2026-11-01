import type { FetchLike } from "../graph.ts";

export type StubbedResponse = {
  status?: number;
  body?: unknown;
  text?: string;
};

export type RecordedCall = {
  url: string;
  method: string;
  body: string | undefined;
};

export function createStubFetch(responses: StubbedResponse[]) {
  const calls: RecordedCall[] = [];

  const fetchImpl: FetchLike = async (url, init) => {
    calls.push({
      url,
      method: init?.method ?? "GET",
      body: typeof init?.body === "string" ? init.body : undefined,
    });

    const response = responses[Math.min(calls.length - 1, responses.length - 1)] ?? {};
    const payload =
      response.text ?? (response.body === undefined ? "" : JSON.stringify(response.body));

    return new Response(payload, { status: response.status ?? 200 });
  };

  function searchParams(index = 0): URLSearchParams {
    const call = calls[index];
    if (!call) {
      throw new Error(`no call recorded at index ${index}`);
    }
    return new URL(call.url).searchParams;
  }

  return { fetchImpl, calls, searchParams };
}
