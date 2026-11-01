export type MetaConfig = {
  appId: string;
  appSecret: string;
  verifyToken: string;
  graphVersion: string;
  graphBaseUrl?: string;
  webBaseUrl?: string;
};

export const DEFAULT_GRAPH_BASE_URL = "https://graph.facebook.com";
export const DEFAULT_WEB_BASE_URL = "https://www.facebook.com";

export function graphBaseUrl(config: MetaConfig): string {
  return `${config.graphBaseUrl ?? DEFAULT_GRAPH_BASE_URL}/${config.graphVersion}`;
}
