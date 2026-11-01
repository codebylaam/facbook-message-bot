import type { GraphApi } from "./graph.ts";

export const MAX_POSTS = 300;
export const POST_PAGE_SIZE = 25;
export const POST_LOOKBACK_MONTHS = 6;

const POST_FIELDS = [
  "id",
  "message",
  "created_time",
  "permalink_url",
  "attachments{media{image{src}},subattachments{media{image{src}}}}",
].join(",");

export type FacebookPost = {
  id: string;
  message: string | null;
  permalink: string | null;
  images: string[];
  createdTime: Date | null;
};

type Attachment = {
  media?: { image?: { src?: string } };
  subattachments?: { data?: Attachment[] };
};

type PostNode = {
  id: string;
  message?: string;
  created_time?: string;
  permalink_url?: string;
  attachments?: { data?: Attachment[] };
};

type PostsResponse = {
  data?: PostNode[];
  paging?: { cursors?: { after?: string }; next?: string };
};

function collectImages(attachment: Attachment, into: string[]): void {
  const src = attachment.media?.image?.src;

  if (typeof src === "string" && src.length > 0) {
    into.push(src);
  }

  for (const child of attachment.subattachments?.data ?? []) {
    collectImages(child, into);
  }
}

function toImages(node: PostNode): string[] {
  const images: string[] = [];

  for (const attachment of node.attachments?.data ?? []) {
    collectImages(attachment, images);
  }

  return [...new Set(images)];
}

function toPost(node: PostNode): FacebookPost {
  const createdTime = node.created_time ? new Date(node.created_time) : null;

  return {
    id: node.id,
    message:
      typeof node.message === "string" && node.message.trim().length > 0 ? node.message : null,
    permalink: typeof node.permalink_url === "string" ? node.permalink_url : null,
    images: toImages(node),
    createdTime: createdTime && !Number.isNaN(createdTime.getTime()) ? createdTime : null,
  };
}

export function lookbackDate(now: Date, months = POST_LOOKBACK_MONTHS): Date {
  const since = new Date(now);
  since.setMonth(since.getMonth() - months);
  return since;
}

export async function fetchPagePosts(
  graphApi: GraphApi,
  options: {
    pageId: string;
    pageAccessToken: string;
    since?: Date;
    limit?: number;
  },
): Promise<FacebookPost[]> {
  const limit = options.limit ?? MAX_POSTS;
  const posts: FacebookPost[] = [];
  let after: string | undefined;

  while (posts.length < limit) {
    const response = await graphApi.request<PostsResponse>(`/${options.pageId}/posts`, {
      accessToken: options.pageAccessToken,
      params: {
        fields: POST_FIELDS,
        limit: POST_PAGE_SIZE,
        ...(options.since === undefined
          ? {}
          : { since: Math.floor(options.since.getTime() / 1000) }),
        ...(after === undefined ? {} : { after }),
      },
    });

    const batch = response.data ?? [];

    if (batch.length === 0) {
      break;
    }

    for (const node of batch) {
      posts.push(toPost(node));

      if (posts.length >= limit) {
        break;
      }
    }

    const nextCursor = response.paging?.cursors?.after;

    if (!nextCursor || nextCursor === after) {
      break;
    }

    after = nextCursor;
  }

  return posts;
}
