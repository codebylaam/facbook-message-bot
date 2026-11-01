export const QUEUES = {
  ingestPage: "ingest-page",
  syncPosts: "sync-posts",
  reembed: "reembed",
  reply: "reply",
  comment: "comment",
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

export const QUEUE_NAMES = Object.values(QUEUES);

export type IngestPageJob = {
  pageId: string;
};

export type SyncPostsJob = {
  pageId: string;
};

export type ReembedJob = {
  pageId: string;
  sourceType: "page_profile" | "post" | "product" | "faq" | "policy";
  sourceId: string;
};

export type JobMap = {
  "ingest-page": IngestPageJob;
  "sync-posts": SyncPostsJob;
  reembed: ReembedJob;
};
