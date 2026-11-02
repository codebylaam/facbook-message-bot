import { eq } from "drizzle-orm";
import type { Db } from "../client.ts";
import { users } from "../schema/auth.ts";

export async function findUserById(db: Db, userId: string) {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

  return user;
}

export async function findUserByEmail(db: Db, email: string) {
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

  return user;
}
