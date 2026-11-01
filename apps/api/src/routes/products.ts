import {
  createProductForPage,
  deleteProductForPage,
  findProductForPage,
  listProductsForPage,
  updateProductForPage,
} from "@fb-bot/db";
import { createProductSchema, QUEUES, updateProductSchema } from "@fb-bot/shared";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { db } from "../db.ts";
import { type AppEnv, requireSession } from "../middleware/auth.ts";
import { enqueue } from "../queue.ts";
import { iso, resolveOwnedPageId } from "./page-scope.ts";

export const productsRoute = new Hono<AppEnv>();

productsRoute.use("*", requireSession);

type ProductRow = Awaited<ReturnType<typeof listProductsForPage>>[number];

function toProduct(row: ProductRow) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    price: row.price,
    salePrice: row.salePrice,
    currency: row.currency,
    stockStatus: row.stockStatus,
    variants: row.variants ?? { sizes: [], colors: [] },
    images: row.images,
    source: row.source,
    status: row.status,
    postId: row.postId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

productsRoute.get("/", async (c) => {
  const user = c.get("user");
  const pageId = await resolveOwnedPageId(db, user.id, c.req.query("pageId"));
  const status = c.req.query("status");
  const source = c.req.query("source");

  const rows = await listProductsForPage(db, pageId, {
    ...(status === "draft" || status === "active" ? { status } : {}),
    ...(source === "manual" || source === "extracted" ? { source } : {}),
  });

  return c.json({ pageId, products: rows.map(toProduct) });
});

productsRoute.post("/", zValidator("json", createProductSchema), async (c) => {
  const user = c.get("user");
  const pageId = await resolveOwnedPageId(db, user.id, c.req.query("pageId"));
  const input = c.req.valid("json");

  const product = await createProductForPage(db, pageId, {
    ...input,
    source: "manual",
    status: input.status ?? "active",
  });

  if (!product) {
    throw new HTTPException(500, { message: "Could not save the product" });
  }

  await enqueue(QUEUES.reembed, { pageId, sourceType: "product", sourceId: product.id });

  return c.json({ product: toProduct(product) }, 201);
});

productsRoute.get("/:id", async (c) => {
  const user = c.get("user");
  const pageId = await resolveOwnedPageId(db, user.id, c.req.query("pageId"));
  const product = await findProductForPage(db, pageId, c.req.param("id"));

  if (!product) {
    throw new HTTPException(404, { message: "Product not found" });
  }

  return c.json({ product: toProduct(product) });
});

productsRoute.patch("/:id", zValidator("json", updateProductSchema), async (c) => {
  const user = c.get("user");
  const pageId = await resolveOwnedPageId(db, user.id, c.req.query("pageId"));
  const input = c.req.valid("json");

  const product = await updateProductForPage(db, pageId, c.req.param("id"), input);

  if (!product) {
    throw new HTTPException(404, { message: "Product not found" });
  }

  await enqueue(QUEUES.reembed, { pageId, sourceType: "product", sourceId: product.id });

  return c.json({ product: toProduct(product) });
});

productsRoute.delete("/:id", async (c) => {
  const user = c.get("user");
  const pageId = await resolveOwnedPageId(db, user.id, c.req.query("pageId"));

  const removed = await deleteProductForPage(db, pageId, c.req.param("id"));

  if (!removed) {
    throw new HTTPException(404, { message: "Product not found" });
  }

  return c.json({ success: true });
});

productsRoute.post("/approve-all", async (c) => {
  const user = c.get("user");
  const pageId = await resolveOwnedPageId(db, user.id, c.req.query("pageId"));
  const drafts = await listProductsForPage(db, pageId, { status: "draft" });

  for (const draft of drafts) {
    await updateProductForPage(db, pageId, draft.id, { status: "active" });
  }

  return c.json({ approved: drafts.length });
});

export { iso };
