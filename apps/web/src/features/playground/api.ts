import type { PlaygroundRequest, PlaygroundResponse } from "@fb-bot/shared";
import { queryOptions } from "@tanstack/react-query";
import { api } from "../../lib/api/client.ts";

export const playgroundConfigQueryOptions = queryOptions({
  queryKey: ["playground", "config"] as const,
  queryFn: async (): Promise<{ configured: boolean; pageId: string }> => {
    const response = await api.get<{ configured: boolean; pageId: string }>("/api/playground");
    return response.data;
  },
});

export async function sendPlaygroundMessage(input: PlaygroundRequest): Promise<PlaygroundResponse> {
  const response = await api.post<PlaygroundResponse>("/api/playground", input);
  return response.data;
}
