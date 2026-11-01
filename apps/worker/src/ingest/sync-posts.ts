import { extractProducts } from "@fb-bot/ai";
import { replaceExtractedProductsForPost, upsertPostForPage } from "@fb-bot/db";
import type { FacebookPost } from "@fb-bot/meta";
import type { WorkerDeps } from "../deps.ts";
import { mapWithConcurrency } from "./concurrency.ts";
import { reembedSource } from "./embed.ts";
import { productSearchText } from "./text.ts";

const POST_CONCURRENCY = 4;

export type SyncPostsResult = {
  posts: number;
  products: number;
  chunks: number;
  extractionFailures: number;
};

export async function syncPosts(
  deps: WorkerDeps,
  pageId: string,
  posts: FacebookPost[],
): Promise<SyncPostsResult> {
  let products = 0;
  let chunks = 0;
  let extractionAttempts = 0;
  let extractionFailures = 0;

  await mapWithConcurrency(posts, POST_CONCURRENCY, async (post) => {
    const stored = await upsertPostForPage(deps.db, pageId, {
      fbPostId: post.id,
      message: post.message,
      permalink: post.permalink,
      images: post.images,
      fbCreatedTime: post.createdTime,
    });

    if (!stored) {
      return;
    }

    chunks += await reembedSource(deps, {
      pageId,
      sourceType: "post",
      sourceId: stored.id,
      text: post.message ?? "",
    });

    if (!stored.included) {
      return;
    }

    extractionAttempts += 1;

    let extracted: Awaited<ReturnType<typeof extractProducts>>;

    try {
      extracted = await extractProducts(deps.llm, {
        message: post.message,
        imageCount: post.images.length,
        createdTime: post.createdTime?.toISOString() ?? null,
      });
    } catch (error) {
      extractionFailures += 1;
      console.warn(`[worker] product extraction failed for post ${post.id}`, error);
      return;
    }

    const rows = await replaceExtractedProductsForPost(
      deps.db,
      pageId,
      stored.id,
      extracted.map((product) => ({
        name: product.name,
        description: product.description,
        price: product.price,
        salePrice: product.salePrice,
        currency: product.currency,
        stockStatus: product.stockStatus,
        variants: { sizes: product.sizes, colors: product.colors },
        images: post.images,
      })),
    );

    products += rows.length;

    for (const row of rows) {
      chunks += await reembedSource(deps, {
        pageId,
        sourceType: "product",
        sourceId: row.id,
        text: productSearchText(row),
      });
    }
  });

  if (extractionAttempts > 0 && extractionFailures === extractionAttempts) {
    throw new Error(
      `every one of the ${extractionAttempts} product extractions failed, so the model or the API key is likely unavailable`,
    );
  }

  return { posts: posts.length, products, chunks, extractionFailures };
}
