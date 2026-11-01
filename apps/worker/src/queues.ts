export const QUEUES = {
  ingestPage: "ingest-page",
  syncPosts: "sync-posts",
  reply: "reply",
  comment: "comment",
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

export const QUEUE_NAMES = Object.values(QUEUES);
