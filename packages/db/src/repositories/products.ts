import { and, count, desc, eq, inArray } from "drizzle-orm";
import type { Db } from "../client.ts";
import type { productSourceEnum, stockStatusEnum } from "../schema/enums.ts";
import { knowledgeChunks, products } from "../schema/knowledge.ts";
import type { ProductVariants } from "../schema/types.ts";

export type StockStatus = (typeof stockStatusEnum.enumValues)[number];
export type ProductSource = (typeof productSourceEnum.enumValues)[number];

export type ProductInput = {
  name: string;
  description?: string | null;
  price?: number | null;
  salePrice?: number | null;
  currency?: string;
  stockStatus?: StockStatus;
  variants?: ProductVariants;
  images?: string[];
  source: ProductSource;
  postId?: string | null;
  status?: "draft" | "active";
};

export type ProductUpdate = Partial<{
  name: string;
  description: string | null;
  price: number | null;
  salePrice: number | null;
  stockStatus: StockStatus;
  variants: ProductVariants;
  images: string[];
  status: "draft" | "active";
}>;

function toNumeric(value: number | null | undefined): string | null | undefined {
  if (value === undefined || value === null) {
    return value;
  }

  return value.toFixed(2);
}

export async function createProductForPage(db: Db, pageId: string, input: ProductInput) {
  const [product] = await db
    .insert(products)
    .values({
      pageId,
      name: input.name,
      description: input.description ?? null,
      price: toNumeric(input.price) ?? null,
      salePrice: toNumeric(input.salePrice) ?? null,
      currency: input.currency ?? "BDT",
      stockStatus: input.stockStatus ?? "unknown",
      variants: input.variants ?? {},
      images: input.images ?? [],
      source: input.source,
      postId: input.postId ?? null,
      status: input.status ?? (input.source === "extracted" ? "draft" : "active"),
    })
    .returning();

  return product;
}

export async function listProductsForPage(
  db: Db,
  pageId: string,
  options: { status?: "draft" | "active"; source?: ProductSource } = {},
) {
  const filters = [eq(products.pageId, pageId)];

  if (options.status) {
    filters.push(eq(products.status, options.status));
  }

  if (options.source) {
    filters.push(eq(products.source, options.source));
  }

  return db
    .select()
    .from(products)
    .where(and(...filters))
    .orderBy(desc(products.createdAt));
}

export async function countProductsForPage(db: Db, pageId: string) {
  const [row] = await db
    .select({ total: count() })
    .from(products)
    .where(eq(products.pageId, pageId));

  return row?.total ?? 0;
}

export async function findProductForPage(db: Db, pageId: string, productId: string) {
  const [product] = await db
    .select()
    .from(products)
    .where(and(eq(products.id, productId), eq(products.pageId, pageId)))
    .limit(1);

  return product;
}

export async function updateProductForPage(
  db: Db,
  pageId: string,
  productId: string,
  patch: ProductUpdate,
) {
  const [product] = await db
    .update(products)
    .set({
      ...patch,
      price: toNumeric(patch.price),
      salePrice: toNumeric(patch.salePrice),
      updatedAt: new Date(),
    })
    .where(and(eq(products.id, productId), eq(products.pageId, pageId)))
    .returning();

  return product;
}

export async function deleteProductForPage(db: Db, pageId: string, productId: string) {
  const deleted = await db
    .delete(products)
    .where(and(eq(products.id, productId), eq(products.pageId, pageId)))
    .returning({ id: products.id });

  return deleted.length > 0;
}

export async function replaceExtractedProductsForPost(
  db: Db,
  pageId: string,
  postId: string,
  inputs: Omit<ProductInput, "source" | "postId">[],
) {
  return db.transaction(async (tx) => {
    const scope = and(
      eq(products.pageId, pageId),
      eq(products.postId, postId),
      eq(products.source, "extracted"),
    );

    // Products are replaced by delete and insert, so their ids change. Any chunks
    // still pointing at the old ids would be unreachable, so they go too.
    const previous = await tx.select({ id: products.id }).from(products).where(scope);

    if (previous.length > 0) {
      await tx.delete(knowledgeChunks).where(
        and(
          eq(knowledgeChunks.pageId, pageId),
          eq(knowledgeChunks.sourceType, "product"),
          inArray(
            knowledgeChunks.sourceId,
            previous.map((row) => row.id),
          ),
        ),
      );

      await tx.delete(products).where(scope);
    }

    if (inputs.length === 0) {
      return [];
    }

    return tx
      .insert(products)
      .values(
        inputs.map((input) => ({
          pageId,
          name: input.name,
          description: input.description ?? null,
          price: toNumeric(input.price) ?? null,
          salePrice: toNumeric(input.salePrice) ?? null,
          currency: input.currency ?? "BDT",
          stockStatus: input.stockStatus ?? "unknown",
          variants: input.variants ?? {},
          images: input.images ?? [],
          source: "extracted" as const,
          postId,
          status: "draft" as const,
        })),
      )
      .returning();
  });
}

export async function listExtractedProductsForPost(db: Db, pageId: string, postId: string) {
  return db
    .select()
    .from(products)
    .where(
      and(
        eq(products.pageId, pageId),
        eq(products.postId, postId),
        eq(products.source, "extracted"),
      ),
    );
}

export async function deleteProductsForPost(db: Db, pageId: string, postId: string) {
  const deleted = await db
    .delete(products)
    .where(and(eq(products.pageId, pageId), eq(products.postId, postId)))
    .returning({ id: products.id });

  return deleted.length;
}

export async function listProductsByIds(db: Db, pageId: string, productIds: string[]) {
  if (productIds.length === 0) {
    return [];
  }

  return db
    .select()
    .from(products)
    .where(and(eq(products.pageId, pageId), inArray(products.id, productIds)));
}
