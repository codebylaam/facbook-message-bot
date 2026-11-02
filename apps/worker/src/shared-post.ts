import type { RetrievedChunk } from "@fb-bot/ai";
import { type Db, findPostByPermalink, listExtractedProductsForPost } from "@fb-bot/db";
import { productSearchText } from "./ingest/text.ts";

/**
 * A customer who shares one of the Page's own posts is asking about that post, so
 * its products are pinned into the context instead of being left to the ranking.
 */
export async function loadSharedPostContext(
  db: Db,
  pageId: string,
  permalink: string,
): Promise<RetrievedChunk[]> {
  const post = await findPostByPermalink(db, pageId, permalink);

  if (!post) {
    return [];
  }

  const products = await listExtractedProductsForPost(db, pageId, post.id);

  return products.map((product) => ({
    id: product.id,
    content: productSearchText(product),
    sourceType: "product" as const,
    sourceId: product.id,
    score: 1,
    vectorRank: null,
    textRank: null,
    trigramRank: null,
  }));
}
