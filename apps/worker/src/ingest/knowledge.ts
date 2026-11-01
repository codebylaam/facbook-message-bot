import { listFaqsForPage, listPoliciesForPage, listProductsForPage } from "@fb-bot/db";
import type { WorkerDeps } from "../deps.ts";
import { reembedSource } from "./embed.ts";
import { faqSearchText, policySearchText, productSearchText } from "./text.ts";

export async function embedStandaloneKnowledge(deps: WorkerDeps, pageId: string): Promise<number> {
  let chunks = 0;

  const faqs = await listFaqsForPage(deps.db, pageId);

  for (const faq of faqs) {
    chunks += await reembedSource(deps, {
      pageId,
      sourceType: "faq",
      sourceId: faq.id,
      text: faqSearchText(faq),
    });
  }

  const policies = await listPoliciesForPage(deps.db, pageId);

  for (const policy of policies) {
    chunks += await reembedSource(deps, {
      pageId,
      sourceType: "policy",
      sourceId: policy.id,
      text: policySearchText(policy),
    });
  }

  const manualProducts = await listProductsForPage(deps.db, pageId, { source: "manual" });

  for (const product of manualProducts) {
    chunks += await reembedSource(deps, {
      pageId,
      sourceType: "product",
      sourceId: product.id,
      text: productSearchText(product),
    });
  }

  return chunks;
}
