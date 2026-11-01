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

/**
 * The reply queue uses the `short` policy: at most one job per singletonKey (the
 * conversation) may be queued. A burst of short messages therefore collapses into
 * a single pending job, while a message that arrives during processing can still
 * queue its own follow-up.
 */
export const QUEUE_POLICIES = {
  [QUEUES.reply]: "short",
} as const;

export type QueuePolicy = (typeof QUEUE_POLICIES)[keyof typeof QUEUE_POLICIES];

export function queueOptions(queue: QueueName): { policy?: QueuePolicy } {
  const policy = (QUEUE_POLICIES as Record<string, QueuePolicy | undefined>)[queue];

  return policy ? { policy } : {};
}

/** The slice of pg-boss this needs, so shared never depends on the driver. */
export type QueueBootstrap = {
  createQueue(name: string, options?: { policy?: QueuePolicy }): Promise<void>;
  getQueue(name: string): Promise<{ policy?: string } | null>;
};

/**
 * Creates every queue with its policy. pg-boss refuses to change a policy after
 * creation, so a queue that already exists with the wrong one is reported loudly
 * rather than silently breaking the debounce.
 */
export async function ensureQueues(
  boss: QueueBootstrap,
  warn: (message: string) => void,
): Promise<void> {
  for (const queue of QUEUE_NAMES) {
    await boss.createQueue(queue, queueOptions(queue));
  }

  for (const queue of QUEUE_NAMES) {
    const expected = queueOptions(queue).policy;

    if (!expected) {
      continue;
    }

    const actual = await boss.getQueue(queue);

    if (actual && actual.policy !== expected) {
      warn(
        `[queue] "${queue}" exists with policy "${actual.policy}" but needs "${expected}". Delete it once so it can be recreated: boss.deleteQueue("${queue}")`,
      );
    }
  }
}
