import { createDb } from "@fb-bot/db";
import { env } from "./env.ts";

export const { db, client, close } = createDb(env.DATABASE_URL);
