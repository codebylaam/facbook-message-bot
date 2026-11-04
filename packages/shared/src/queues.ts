export const QUEUES = {
  ingestPage: "ingest-page",
  syncPosts: "sync-posts",
  reembed: "reembed",
  reply: "reply",
  comment: "comment",
  resyncAll: "resync-all",
  deadLetter: "dead-letter",
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
  sourceType: "page_profile" | "post" | "product" | "faq" | "policy" | "document";
  sourceId: string;
};

export type JobMap = {
  "ingest-page": IngestPageJob;
  "sync-posts": SyncPostsJob;
  reembed: ReembedJob;
  "resync-all": Record<string, never>;
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

type RetryPolicy = {
  retryLimit: number;
  retryDelay: number;
  retryBackoff: boolean;
};

/**
 * Every worker queue retries with backoff and then parks the job on the
 * dead-letter queue, so a permanently broken job is inspectable instead of
 * looping forever.
 */
const RETRY: Partial<Record<QueueName, RetryPolicy>> = {
  [QUEUES.ingestPage]: { retryLimit: 3, retryDelay: 30, retryBackoff: true },
  [QUEUES.syncPosts]: { retryLimit: 3, retryDelay: 30, retryBackoff: true },
  [QUEUES.reembed]: { retryLimit: 5, retryDelay: 15, retryBackoff: true },
  [QUEUES.reply]: { retryLimit: 5, retryDelay: 10, retryBackoff: true },
  [QUEUES.comment]: { retryLimit: 5, retryDelay: 15, retryBackoff: true },
  [QUEUES.resyncAll]: { retryLimit: 2, retryDelay: 60, retryBackoff: true },
};

export type QueueOptionsShape = {
  policy?: QueuePolicy;
  retryLimit?: number;
  retryDelay?: number;
  retryBackoff?: boolean;
  deadLetter?: string;
};

export function queueOptions(queue: QueueName): QueueOptionsShape {
  if (queue === QUEUES.deadLetter) {
    // The dead letter queue is a dead end on purpose: retrying it would loop.
    return { retryLimit: 0 };
  }

  const policy = (QUEUE_POLICIES as Record<string, QueuePolicy | undefined>)[queue];
  const retry = RETRY[queue];

  return {
    deadLetter: QUEUES.deadLetter,
    ...(policy ? { policy } : {}),
    ...(retry ?? { retryLimit: 3, retryDelay: 30, retryBackoff: true }),
  };
}

/** The slice of pg-boss this needs, so shared never depends on the driver. */
export type QueueBootstrap = {
  createQueue(name: string, options?: QueueOptionsShape): Promise<void>;
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
  // The dead letter queue has to exist before a queue can point at it.
  const ordered = [
    QUEUES.deadLetter,
    ...QUEUE_NAMES.filter((queue) => queue !== QUEUES.deadLetter),
  ];

  for (const queue of ordered) {
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
