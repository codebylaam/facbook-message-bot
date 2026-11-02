import { ensureQueues, type QueueName } from "@fb-bot/shared";
import { PgBoss } from "pg-boss";
import { env } from "./env.ts";
import { logger } from "./logger.ts";

let bossPromise: Promise<PgBoss> | undefined;

async function getBoss(): Promise<PgBoss> {
  bossPromise ??= (async () => {
    const boss = new PgBoss({ connectionString: env.DATABASE_URL });
    boss.on("error", (error) => {
      logger.error({ err: error }, "[api] pg-boss error");
    });
    await boss.start();

    await ensureQueues(boss, (message) => logger.warn(message));

    return boss;
  })();

  return bossPromise;
}

export type EnqueueOptions = {
  /** Collapses a burst into one job while a job with the same key is pending. */
  singletonKey?: string;
  startAfterSeconds?: number;
};

export async function enqueue(
  queue: QueueName,
  data: Record<string, unknown>,
  options: EnqueueOptions = {},
): Promise<void> {
  const boss = await getBoss();
  await boss.send(queue, data, {
    ...(options.singletonKey ? { singletonKey: options.singletonKey } : {}),
    ...(options.startAfterSeconds === undefined ? {} : { startAfter: options.startAfterSeconds }),
  });
}

export async function closeQueue(): Promise<void> {
  const boss = await bossPromise;
  bossPromise = undefined;
  await boss?.stop({ graceful: true });
}
