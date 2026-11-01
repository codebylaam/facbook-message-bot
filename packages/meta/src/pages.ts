import type { GraphApi } from "./graph.ts";

export const SUBSCRIBED_FIELDS = [
  "messages",
  "messaging_postbacks",
  "message_echoes",
  "feed",
] as const;

export async function subscribeAppToPage(
  graphApi: GraphApi,
  options: { pageId: string; pageAccessToken: string },
): Promise<boolean> {
  const response = await graphApi.request<{ success?: boolean }>(
    `/${options.pageId}/subscribed_apps`,
    {
      method: "POST",
      accessToken: options.pageAccessToken,
      params: { subscribed_fields: SUBSCRIBED_FIELDS.join(",") },
    },
  );

  return response.success ?? false;
}

export async function unsubscribeAppFromPage(
  graphApi: GraphApi,
  options: { pageId: string; pageAccessToken: string },
): Promise<boolean> {
  const response = await graphApi.request<{ success?: boolean }>(
    `/${options.pageId}/subscribed_apps`,
    {
      method: "DELETE",
      accessToken: options.pageAccessToken,
    },
  );

  return response.success ?? false;
}

export async function fetchSubscribedFields(
  graphApi: GraphApi,
  options: { pageId: string; pageAccessToken: string },
): Promise<string[]> {
  const response = await graphApi.request<{ data?: Array<{ subscribed_fields?: string[] }> }>(
    `/${options.pageId}/subscribed_apps`,
    { accessToken: options.pageAccessToken },
  );

  return response.data?.[0]?.subscribed_fields ?? [];
}
