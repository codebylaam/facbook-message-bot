import { QUEUE_NAMES } from "@fb-bot/shared";
import { PgBoss } from "pg-boss";
import { closeDb, getEncryptionKey } from "./deps.ts";
import { env } from "./env.ts";
import { registerHandlers } from "./handlers.ts";

const boss = new PgBoss({ connectionString: env.DATABASE_URL });

boss.on("error", (error) => {
  console.error("[worker] pg-boss error", error);
});

// Fail fast on a missing or malformed key rather than on the first job.
getEncryptionKey();

await boss.start();

for (const queue of QUEUE_NAMES) {
  await boss.createQueue(queue);
}

await registerHandlers(boss);

console.log(`[worker] ready with queues: ${QUEUE_NAMES.join(", ")}`);

async function shutdown(signal: string) {
  console.log(`[worker] ${signal} received, shutting down`);
  await boss.stop({ graceful: true });
  await closeDb();
  process.exit(0);
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});
process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
