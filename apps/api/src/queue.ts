import { QUEUES, type QueueName } from "@fb-bot/shared";
import { PgBoss } from "pg-boss";
import { env } from "./env.ts";

let bossPromise: Promise<PgBoss> | undefined;

async function getBoss(): Promise<PgBoss> {
  bossPromise ??= (async () => {
    const boss = new PgBoss({ connectionString: env.DATABASE_URL });
    boss.on("error", (error) => {
      console.error("[api] pg-boss error", error);
    });
    await boss.start();

    for (const queue of Object.values(QUEUES)) {
      await boss.createQueue(queue);
    }

    return boss;
  })();

  return bossPromise;
}

export async function enqueue(queue: QueueName, data: Record<string, unknown>): Promise<void> {
  const boss = await getBoss();
  await boss.send(queue, data);
}

export async function closeQueue(): Promise<void> {
  const boss = await bossPromise;
  bossPromise = undefined;
  await boss?.stop({ graceful: true });
}
