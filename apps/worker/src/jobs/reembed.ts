import {
  findFaqForPage,
  findPageProfile,
  findPolicyForPage,
  findPostById,
  findProductForPage,
} from "@fb-bot/db";
import { profileLines } from "@fb-bot/meta";
import type { ReembedJob } from "@fb-bot/shared";
import type { WorkerDeps } from "../deps.ts";
import { reembedSource } from "../ingest/embed.ts";
import { faqSearchText, policySearchText, productSearchText } from "../ingest/text.ts";

export type ReembedResult = {
  sourceType: ReembedJob["sourceType"];
  sourceId: string;
  chunks: number;
  skipped: boolean;
};

export async function reembedSourceById(deps: WorkerDeps, job: ReembedJob): Promise<ReembedResult> {
  const text = await resolveSourceText(deps, job);

  if (text === undefined) {
    return { sourceType: job.sourceType, sourceId: job.sourceId, chunks: 0, skipped: true };
  }

  const chunks = await reembedSource(deps, {
    pageId: job.pageId,
    sourceType: job.sourceType,
    sourceId: job.sourceId,
    text,
  });

  return { sourceType: job.sourceType, sourceId: job.sourceId, chunks, skipped: false };
}

async function resolveSourceText(deps: WorkerDeps, job: ReembedJob): Promise<string | undefined> {
  switch (job.sourceType) {
    case "faq": {
      const faq = await findFaqForPage(deps.db, job.pageId, job.sourceId);
      return faq ? faqSearchText(faq) : undefined;
    }

    case "policy": {
      const policy = await findPolicyForPage(deps.db, job.pageId, job.sourceId);
      return policy ? policySearchText(policy) : undefined;
    }

    case "product": {
      const product = await findProductForPage(deps.db, job.pageId, job.sourceId);
      return product ? productSearchText(product) : undefined;
    }

    case "post": {
      const post = await findPostById(deps.db, job.pageId, job.sourceId);
      return post?.message ?? undefined;
    }

    case "page_profile": {
      const profile = await findPageProfile(deps.db, job.pageId);
      return profile ? profileLines(profile).join("\n") : undefined;
    }

    default:
      return undefined;
  }
}
