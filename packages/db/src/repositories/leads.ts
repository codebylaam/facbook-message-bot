import { desc, eq } from "drizzle-orm";
import type { Db } from "../client.ts";
import { customers, leads } from "../schema/conversations.ts";
import type { LeadItem } from "../schema/types.ts";

export type NewLead = {
  pageId: string;
  conversationId?: string | null;
  customerId?: string | null;
  name?: string | null;
  phone?: string | null;
  address?: string | null;
  items?: LeadItem[];
  note?: string | null;
};

export async function createLead(db: Db, input: NewLead) {
  const [lead] = await db
    .insert(leads)
    .values({
      pageId: input.pageId,
      conversationId: input.conversationId ?? null,
      customerId: input.customerId ?? null,
      name: input.name ?? null,
      phone: input.phone ?? null,
      address: input.address ?? null,
      items: input.items ?? [],
      note: input.note ?? null,
    })
    .returning();

  return lead;
}

export async function listLeadsForPage(db: Db, pageId: string, limit = 50) {
  return db.select().from(leads).where(eq(leads.pageId, pageId)).limit(limit);
}

export async function listLeadsWithCustomer(db: Db, pageId: string, limit = 50) {
  return db
    .select({
      id: leads.id,
      pageId: leads.pageId,
      conversationId: leads.conversationId,
      customerName: customers.name,
      customerPsid: customers.psid,
      name: leads.name,
      phone: leads.phone,
      address: leads.address,
      items: leads.items,
      status: leads.status,
      note: leads.note,
      createdAt: leads.createdAt,
    })
    .from(leads)
    .leftJoin(customers, eq(leads.customerId, customers.id))
    .where(eq(leads.pageId, pageId))
    .orderBy(desc(leads.createdAt))
    .limit(limit);
}
