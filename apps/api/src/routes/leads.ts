import { listLeadsWithCustomer } from "@fb-bot/db";
import { Hono } from "hono";
import { db } from "../db.ts";
import { type AppEnv, requireSession } from "../middleware/auth.ts";
import { resolveOwnedPageId } from "./page-scope.ts";

export const leadsRoute = new Hono<AppEnv>();

leadsRoute.use("*", requireSession);

leadsRoute.get("/", async (c) => {
  const user = c.get("user");
  const pageId = await resolveOwnedPageId(db, user.id, c.req.query("pageId"));

  const rows = await listLeadsWithCustomer(db, pageId, 100);

  return c.json({
    pageId,
    leads: rows.map((row) => ({
      id: row.id,
      pageId: row.pageId,
      conversationId: row.conversationId,
      customerName: row.customerName,
      customerPsid: row.customerPsid,
      name: row.name,
      phone: row.phone,
      address: row.address,
      items: row.items,
      status: row.status,
      note: row.note,
      createdAt: row.createdAt.toISOString(),
    })),
  });
});
