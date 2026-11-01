import { and, asc, desc, eq } from "drizzle-orm";
import type { Db } from "../client.ts";
import type { commentModeEnum, webhookStatusEnum } from "../schema/enums.ts";
import { fbPages } from "../schema/pages.ts";
import type { HandoffRules, Persona } from "../schema/types.ts";

export type WebhookStatus = (typeof webhookStatusEnum.enumValues)[number];
export type CommentMode = (typeof commentModeEnum.enumValues)[number];

export type NewFbPage = {
  fbPageId: string;
  name: string;
  accessTokenEncrypted: string;
};

export type FbPageUpdate = Partial<{
  name: string;
  accessTokenEncrypted: string;
  botEnabled: boolean;
  webhookStatus: WebhookStatus;
  lastSyncedAt: Date;
  commentMode: CommentMode;
  confidenceThreshold: number;
  persona: Persona | null;
  handoffRules: HandoffRules | null;
}>;

export async function listPagesForOwner(db: Db, ownerId: string) {
  return db
    .select()
    .from(fbPages)
    .where(eq(fbPages.ownerId, ownerId))
    .orderBy(desc(fbPages.createdAt));
}

export async function findPageForOwner(db: Db, ownerId: string, pageId: string) {
  const [page] = await db
    .select()
    .from(fbPages)
    .where(and(eq(fbPages.id, pageId), eq(fbPages.ownerId, ownerId)))
    .limit(1);

  return page;
}

export async function findPageByFbPageId(db: Db, fbPageId: string) {
  const [page] = await db.select().from(fbPages).where(eq(fbPages.fbPageId, fbPageId)).limit(1);

  return page;
}

export async function findPageById(db: Db, pageId: string) {
  const [page] = await db.select().from(fbPages).where(eq(fbPages.id, pageId)).limit(1);

  return page;
}

export async function listPagesForSync(db: Db) {
  return db.select().from(fbPages).orderBy(asc(fbPages.createdAt));
}

export async function markPageSynced(db: Db, pageId: string, syncedAt = new Date()) {
  const [page] = await db
    .update(fbPages)
    .set({ lastSyncedAt: syncedAt, webhookStatus: "active", updatedAt: new Date() })
    .where(eq(fbPages.id, pageId))
    .returning();

  return page;
}

export async function createPageForOwner(db: Db, ownerId: string, input: NewFbPage) {
  const [page] = await db
    .insert(fbPages)
    .values({ ...input, ownerId })
    .returning();

  return page;
}

export async function upsertPageForOwner(
  db: Db,
  ownerId: string,
  input: { fbPageId: string; name: string; accessTokenEncrypted: string },
) {
  const [page] = await db
    .insert(fbPages)
    .values({ ...input, ownerId })
    .onConflictDoUpdate({
      target: fbPages.fbPageId,
      set: {
        name: input.name,
        accessTokenEncrypted: input.accessTokenEncrypted,
        updatedAt: new Date(),
      },
    })
    .returning();

  return page;
}

export async function updatePageForOwner(
  db: Db,
  ownerId: string,
  pageId: string,
  patch: FbPageUpdate,
) {
  return db
    .update(fbPages)
    .set(patch)
    .where(and(eq(fbPages.id, pageId), eq(fbPages.ownerId, ownerId)))
    .returning();
}

export async function deletePageForOwner(db: Db, ownerId: string, pageId: string) {
  return db
    .delete(fbPages)
    .where(and(eq(fbPages.id, pageId), eq(fbPages.ownerId, ownerId)))
    .returning({ id: fbPages.id });
}
