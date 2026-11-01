import { eq } from "drizzle-orm";
import type { Db } from "../client.ts";
import { pageProfile } from "../schema/pages.ts";

export type PageProfileInput = {
  about?: string | null;
  description?: string | null;
  phone?: string | null;
  address?: string | null;
  website?: string | null;
  emails?: string[] | null;
  hours?: Record<string, string> | null;
};

export async function upsertPageProfile(db: Db, pageId: string, input: PageProfileInput) {
  const [profile] = await db
    .insert(pageProfile)
    .values({ pageId, ...input })
    .onConflictDoUpdate({
      target: pageProfile.pageId,
      set: { ...input, updatedAt: new Date() },
    })
    .returning();

  return profile;
}

export async function findPageProfile(db: Db, pageId: string) {
  const [profile] = await db
    .select()
    .from(pageProfile)
    .where(eq(pageProfile.pageId, pageId))
    .limit(1);

  return profile;
}
