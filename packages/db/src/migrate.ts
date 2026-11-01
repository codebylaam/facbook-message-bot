import { parseEnv, serverEnvSchema } from "@fb-bot/shared";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { createDb } from "./client.ts";

const env = parseEnv(serverEnvSchema, process.env);
const { db, close } = createDb(env.DATABASE_URL, { max: 1 });

const migrationsFolder = new URL("../drizzle", import.meta.url).pathname;

await migrate(db, { migrationsFolder });
await close();

console.log(`migrations applied from ${migrationsFolder}`);
