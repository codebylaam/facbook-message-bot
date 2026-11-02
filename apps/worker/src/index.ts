import { ensureQueues, QUEUE_NAMES } from "@fb-bot/shared";
import { PgBoss } from "pg-boss";
import { closeDb, getEncryptionKey } from "./deps.ts";
import { env } from "./env.ts";
import { registerHandlers } from "./handlers.ts";
import { logger } from "./logger.ts";

const boss = new PgBoss({ connectionString: env.DATABASE_URL });

boss.on("error", (error) => {
  logger.error({ err: error }, "[worker] pg-boss error");
});

// Fail fast on a missing or malformed key rather than on the first job.
getEncryptionKey();

await boss.start();

await ensureQueues(boss, (message) => logger.warn(message));

await registerHandlers(boss);

logger.info(`[worker] ready with queues: ${QUEUE_NAMES.join(", ")}`);

async function shutdown(signal: string) {
  logger.info(`[worker] ${signal} received, shutting down`);
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
