import { and, asc, eq } from "drizzle-orm";
import type { Db } from "../client.ts";
import { policies } from "../schema/knowledge.ts";

export async function listPoliciesForPage(db: Db, pageId: string) {
  return db
    .select()
    .from(policies)
    .where(eq(policies.pageId, pageId))
    .orderBy(asc(policies.createdAt));
}

export async function findPolicyForPage(db: Db, pageId: string, policyId: string) {
  const [policy] = await db
    .select()
    .from(policies)
    .where(and(eq(policies.id, policyId), eq(policies.pageId, pageId)))
    .limit(1);

  return policy;
}

export async function createPolicyForPage(
  db: Db,
  pageId: string,
  input: { title: string; content: string },
) {
  const [policy] = await db
    .insert(policies)
    .values({ pageId, title: input.title, content: input.content })
    .returning();

  return policy;
}

export async function updatePolicyForPage(
  db: Db,
  pageId: string,
  policyId: string,
  patch: { title?: string; content?: string },
) {
  const [policy] = await db
    .update(policies)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(policies.id, policyId), eq(policies.pageId, pageId)))
    .returning();

  return policy;
}

export async function deletePolicyForPage(db: Db, pageId: string, policyId: string) {
  const deleted = await db
    .delete(policies)
    .where(and(eq(policies.id, policyId), eq(policies.pageId, pageId)))
    .returning({ id: policies.id });

  return deleted.length > 0;
}
