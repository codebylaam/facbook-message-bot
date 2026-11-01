import { and, asc, eq } from "drizzle-orm";
import type { Db } from "../client.ts";
import { faqs } from "../schema/knowledge.ts";

export async function listFaqsForPage(db: Db, pageId: string) {
  return db.select().from(faqs).where(eq(faqs.pageId, pageId)).orderBy(asc(faqs.createdAt));
}

export async function findFaqForPage(db: Db, pageId: string, faqId: string) {
  const [faq] = await db
    .select()
    .from(faqs)
    .where(and(eq(faqs.id, faqId), eq(faqs.pageId, pageId)))
    .limit(1);

  return faq;
}

export async function createFaqForPage(
  db: Db,
  pageId: string,
  input: { question: string; answer: string },
) {
  const [faq] = await db
    .insert(faqs)
    .values({ pageId, question: input.question, answer: input.answer })
    .returning();

  return faq;
}

export async function updateFaqForPage(
  db: Db,
  pageId: string,
  faqId: string,
  patch: { question?: string; answer?: string },
) {
  const [faq] = await db
    .update(faqs)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(faqs.id, faqId), eq(faqs.pageId, pageId)))
    .returning();

  return faq;
}

export async function deleteFaqForPage(db: Db, pageId: string, faqId: string) {
  const deleted = await db
    .delete(faqs)
    .where(and(eq(faqs.id, faqId), eq(faqs.pageId, pageId)))
    .returning({ id: faqs.id });

  return deleted.length > 0;
}
