import { and, eq } from "drizzle-orm";
import type { Db } from "../client.ts";
import { customers } from "../schema/conversations.ts";

export async function findCustomerByPsid(db: Db, pageId: string, psid: string) {
  const [customer] = await db
    .select()
    .from(customers)
    .where(and(eq(customers.pageId, pageId), eq(customers.psid, psid)))
    .limit(1);

  return customer;
}

export async function findOrCreateCustomer(
  db: Db,
  pageId: string,
  psid: string,
  name?: string | null,
) {
  const existing = await findCustomerByPsid(db, pageId, psid);

  if (existing) {
    return existing;
  }

  const [created] = await db
    .insert(customers)
    .values({ pageId, psid, name: name ?? null })
    .onConflictDoNothing()
    .returning();

  return created ?? (await findCustomerByPsid(db, pageId, psid));
}

export async function setCustomerName(db: Db, pageId: string, psid: string, name: string) {
  const [customer] = await db
    .update(customers)
    .set({ name, updatedAt: new Date() })
    .where(and(eq(customers.pageId, pageId), eq(customers.psid, psid)))
    .returning();

  return customer;
}

export async function findCustomerById(db: Db, customerId: string) {
  const [customer] = await db.select().from(customers).where(eq(customers.id, customerId)).limit(1);

  return customer;
}
