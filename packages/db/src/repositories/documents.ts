import { and, asc, count, desc, eq } from "drizzle-orm";
import type { Db } from "../client.ts";
import { documents } from "../schema/knowledge.ts";

/**
 * The list view only needs to name a document, so the extracted text stays out of
 * every read except the one the reembed job needs.
 */
const summaryColumns = {
  id: documents.id,
  name: documents.name,
  mimeType: documents.mimeType,
  byteSize: documents.byteSize,
  createdAt: documents.createdAt,
  updatedAt: documents.updatedAt,
};

export async function listDocumentsForPage(db: Db, pageId: string) {
  return db
    .select(summaryColumns)
    .from(documents)
    .where(eq(documents.pageId, pageId))
    .orderBy(desc(documents.createdAt));
}

/** The ingest sweep re-reads the text, so it asks for the content as well. */
export async function listDocumentContentsForPage(db: Db, pageId: string) {
  return db
    .select({ id: documents.id, name: documents.name, content: documents.content })
    .from(documents)
    .where(eq(documents.pageId, pageId))
    .orderBy(asc(documents.createdAt));
}

export async function findDocumentForPage(db: Db, pageId: string, documentId: string) {
  const [document] = await db
    .select(summaryColumns)
    .from(documents)
    .where(and(eq(documents.id, documentId), eq(documents.pageId, pageId)))
    .limit(1);

  return document;
}

/** Includes the extracted text: the reembed job is the only caller that needs it. */
export async function findDocumentById(db: Db, documentId: string) {
  const [document] = await db.select().from(documents).where(eq(documents.id, documentId)).limit(1);

  return document;
}

export async function createDocumentForPage(
  db: Db,
  pageId: string,
  input: { name: string; mimeType: string; byteSize: number; content: string },
) {
  const [document] = await db
    .insert(documents)
    .values({ pageId, ...input })
    .returning(summaryColumns);

  return document;
}

export async function deleteDocumentForPage(db: Db, pageId: string, documentId: string) {
  const deleted = await db
    .delete(documents)
    .where(and(eq(documents.id, documentId), eq(documents.pageId, pageId)))
    .returning({ id: documents.id });

  return deleted.length > 0;
}

export async function countDocumentsForPage(db: Db, pageId: string) {
  const [row] = await db
    .select({ total: count() })
    .from(documents)
    .where(eq(documents.pageId, pageId));

  return row?.total ?? 0;
}
