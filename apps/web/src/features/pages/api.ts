import type {
  ConnectedPage,
  ConnectPageInput,
  DiscoveredPage,
  DiscoverPagesInput,
  LoginConfig,
} from "@fb-bot/shared";
import { queryOptions } from "@tanstack/react-query";
import { api } from "../../lib/api/client.ts";

export const pagesQueryOptions = queryOptions({
  queryKey: ["pages"] as const,
  queryFn: async (): Promise<ConnectedPage[]> => {
    const response = await api.get<{ pages: ConnectedPage[] }>("/api/pages");
    return response.data.pages;
  },
});

export const loginConfigQueryOptions = queryOptions({
  queryKey: ["pages", "login-config"] as const,
  queryFn: async (): Promise<LoginConfig> => {
    const response = await api.get<LoginConfig>("/api/pages/login-config");
    return response.data;
  },
});

export async function discoverPages(input: DiscoverPagesInput): Promise<DiscoveredPage[]> {
  const response = await api.post<{ pages: DiscoveredPage[] }>("/api/pages/discover", input);
  return response.data.pages;
}

export async function connectPage(input: ConnectPageInput): Promise<void> {
  await api.post("/api/pages", input);
}

export async function disconnectPage(pageId: string): Promise<void> {
  await api.delete(`/api/pages/${pageId}`);
}
