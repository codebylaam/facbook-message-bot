import { PgBoss } from "pg-boss";
import { env } from "./env.ts";
import { QUEUE_NAMES } from "./queues.ts";

const boss = new PgBoss({ connectionString: env.DATABASE_URL });

boss.on("error", (error) => {
  console.error("[worker] pg-boss error", error);
});

await boss.start();

for (const queue of QUEUE_NAMES) {
  await boss.createQueue(queue);
  await boss.work(queue, async (jobs) => {
    console.log(`[worker] ${queue}: received ${jobs.length} job(s)`);
  });
}

console.log(`[worker] ready with queues: ${QUEUE_NAMES.join(", ")}`);

async function shutdown(signal: string) {
  console.log(`[worker] ${signal} received, shutting down`);
  await boss.stop({ graceful: true });
  process.exit(0);
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});
process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
