import { DEFAULT_WEB_BASE_URL, type MetaConfig } from "./config.ts";
import type { GraphApi } from "./graph.ts";

export const META_SCOPES = [
  "pages_show_list",
  "pages_messaging",
  "pages_read_engagement",
  "pages_manage_metadata",
  "pages_read_user_content",
  "pages_manage_engagement",
] as const;

export function buildLoginUrl(
  config: MetaConfig,
  options: { redirectUri: string; state: string },
): string {
  const url = new URL(
    `${config.webBaseUrl ?? DEFAULT_WEB_BASE_URL}/${config.graphVersion}/dialog/oauth`,
  );
  url.searchParams.set("client_id", config.appId);
  url.searchParams.set("redirect_uri", options.redirectUri);
  url.searchParams.set("state", options.state);
  url.searchParams.set("scope", META_SCOPES.join(","));
  url.searchParams.set("response_type", "code");
  return url.toString();
}

type TokenResponse = {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
};

type PagesResponse = {
  data?: Array<{
    id: string;
    name?: string;
    access_token?: string;
    tasks?: string[];
    category?: string;
  }>;
};

export type FacebookPageCandidate = {
  id: string;
  name: string;
  accessToken: string;
  tasks: string[];
  category?: string;
};

export async function exchangeCodeForShortLivedToken(
  graphApi: GraphApi,
  config: MetaConfig,
  options: { code: string; redirectUri: string },
): Promise<{ accessToken: string; expiresIn?: number }> {
  const response = await graphApi.request<TokenResponse>("/oauth/access_token", {
    params: {
      client_id: config.appId,
      client_secret: config.appSecret,
      redirect_uri: options.redirectUri,
      code: options.code,
    },
  });

  if (!response.access_token) {
    throw new Error("Facebook did not return an access token for the supplied code");
  }

  return { accessToken: response.access_token, expiresIn: response.expires_in };
}

export async function exchangeForLongLivedToken(
  graphApi: GraphApi,
  config: MetaConfig,
  shortLivedToken: string,
): Promise<{ accessToken: string; expiresIn?: number }> {
  const response = await graphApi.request<TokenResponse>("/oauth/access_token", {
    params: {
      grant_type: "fb_exchange_token",
      client_id: config.appId,
      client_secret: config.appSecret,
      fb_exchange_token: shortLivedToken,
    },
  });

  if (!response.access_token) {
    throw new Error("Facebook did not return a long-lived access token");
  }

  return { accessToken: response.access_token, expiresIn: response.expires_in };
}

export async function fetchManagedPages(
  graphApi: GraphApi,
  userAccessToken: string,
): Promise<FacebookPageCandidate[]> {
  const response = await graphApi.request<PagesResponse>("/me/accounts", {
    accessToken: userAccessToken,
    params: { fields: "id,name,access_token,tasks,category", limit: 100 },
  });

  return (response.data ?? [])
    .filter(
      (page): page is typeof page & { access_token: string } =>
        typeof page.access_token === "string",
    )
    .map((page) => ({
      id: page.id,
      name: page.name ?? page.id,
      accessToken: page.access_token,
      tasks: page.tasks ?? [],
      category: page.category,
    }));
}
