import {
  hybridSearch,
  type ReplyTurn,
  runReplyEngine,
  shouldRefreshSummary,
  summarizeConversation,
} from "@fb-bot/ai";
import {
  countAiReplies,
  createLead,
  findActiveSubscriptionWithPlan,
  findConversationById,
  findCustomerById,
  findPageById,
  findPageProfile,
  incrementAiReplies,
  insertMessage,
  listPendingInboundMessages,
  listPoliciesForPage,
  listRecentMessages,
  periodStartFor,
  recordOutboundMessage,
  setConversationMode,
  setConversationSummary,
} from "@fb-bot/db";
import { decryptToken, profileLines, sendTextMessage, showTypingThenWait } from "@fb-bot/meta";
import type { WorkerDeps } from "../deps.ts";
import { env } from "../env.ts";
import { evaluateGuards } from "../guards.ts";
import { notifyInbox } from "../inbox-events.ts";

export type ReplyJob = { conversationId: string };

export type ReplyJobResult = {
  conversationId: string;
  action: "sent" | "handoff" | "skipped" | "requeued";
  reason?: string;
};

export type ReplyJobOptions = {
  enqueueReply: (conversationId: string) => Promise<unknown>;
  typingDelayMs?: number;
};

export async function handleReply(
  deps: WorkerDeps,
  job: ReplyJob,
  options: ReplyJobOptions,
): Promise<ReplyJobResult> {
  const conversationId = job.conversationId;
  const conversation = await findConversationById(deps.db, conversationId);

  if (!conversation) {
    return { conversationId, action: "skipped", reason: "the conversation no longer exists" };
  }

  const page = await findPageById(deps.db, conversation.pageId);

  if (!page) {
    return { conversationId, action: "skipped", reason: "the page no longer exists" };
  }

  const pending = await listPendingInboundMessages(deps.db, conversationId);

  if (pending.length === 0) {
    return { conversationId, action: "skipped", reason: "no unanswered messages" };
  }

  const customer = await findCustomerById(deps.db, conversation.customerId);

  if (!customer) {
    return { conversationId, action: "skipped", reason: "the customer no longer exists" };
  }

  const period = periodStartFor();
  const [used, subscription] = await Promise.all([
    countAiReplies(deps.db, page.ownerId, period),
    findActiveSubscriptionWithPlan(deps.db, page.ownerId),
  ]);

  const guard = evaluateGuards({
    botEnabled: page.botEnabled,
    mode: conversation.mode,
    lastCustomerMessageAt: conversation.lastCustomerMsgAt,
    aiRepliesUsed: used,
    aiRepliesLimit: subscription?.aiRepliesPerMonth ?? env.DEFAULT_AI_REPLIES_LIMIT,
  });

  if (!guard.allowed) {
    return { conversationId, action: "skipped", reason: guard.message };
  }

  const texts = pending
    .map((message) => message.text?.trim() ?? "")
    .filter((text) => text.length > 0);

  if (texts.length === 0) {
    return handOff(deps, {
      pageId: page.id,
      conversationId,
      reason: "The customer sent only attachments",
      draft: null,
    });
  }

  const message = texts.join("\n");
  const pageAccessToken = decryptToken(page.accessTokenEncrypted, deps.encryptionKey);

  const retrieve = async (query: string) => {
    let embedding: number[] | null = null;

    if (deps.embeddings) {
      try {
        embedding = await deps.embeddings.embedOne(query);
      } catch (error) {
        console.warn("[worker] embedding the query failed, searching by text only", error);
      }
    }

    return hybridSearch(deps.db, { pageId: page.id, query, embedding });
  };

  const [profile, policies, recent] = await Promise.all([
    findPageProfile(deps.db, page.id),
    listPoliciesForPage(deps.db, page.id),
    listRecentMessages(deps.db, conversationId, 10),
  ]);

  const history: ReplyTurn[] = recent
    .filter((row) => (row.text ?? "").trim().length > 0)
    .map((row) => ({ role: row.sender, text: row.text ?? "" }));

  const result = await runReplyEngine({
    llm: deps.llm,
    knowledge: {
      pageName: page.name,
      persona: page.persona,
      profileLines: profile ? profileLines(profile) : [],
      policies: policies.map((policy) => ({ title: policy.title, content: policy.content })),
    },
    retrieve,
    message,
    confidenceThreshold: page.confidenceThreshold,
    history,
    summary: conversation.summary,
  });

  await incrementAiReplies(deps.db, page.ownerId, period);

  const aiMetadata = result.output
    ? {
        confidence: result.output.confidence,
        intent: result.output.intent,
        needsHuman: result.output.needsHuman,
        handoffReason: result.output.handoffReason ?? undefined,
        sourceIds: result.output.sourceIds,
        promptTokens: result.usage.promptTokens,
        completionTokens: result.usage.completionTokens,
        totalTokens: result.usage.totalTokens,
      }
    : null;

  if (result.output?.lead) {
    await createLead(deps.db, {
      pageId: page.id,
      conversationId,
      customerId: customer.id,
      name: result.output.lead.name,
      phone: result.output.lead.phone,
      address: result.output.lead.address,
      items: result.output.lead.items.map((item) => ({
        name: item.name,
        quantity: item.quantity ?? undefined,
        variant: item.variant ?? undefined,
      })),
      note: "Captured from a conversation",
    });

    await notifyInbox(deps.db, { conversationId, pageId: page.id, kind: "lead" });
  }

  if (result.decision.action === "send") {
    const sendTarget = {
      pageId: page.fbPageId,
      pageAccessToken,
      recipientId: customer.psid,
    };

    await showTypingThenWait(deps.graphApi, sendTarget, {
      delayMs: options.typingDelayMs ?? env.REPLY_TYPING_DELAY_MS,
    });

    const sent = await sendTextMessage(deps.graphApi, {
      ...sendTarget,
      text: result.decision.reply,
    });

    await insertMessage(deps.db, {
      conversationId,
      mid: sent.messageId,
      direction: "outbound",
      sender: "bot",
      text: result.decision.reply,
      aiMetadata,
    });

    const updated = await recordOutboundMessage(deps.db, conversationId);
    await refreshSummary(deps, updated?.messageCount ?? 0, conversationId, page.name);
    await notifyInbox(deps.db, { conversationId, pageId: page.id, kind: "sent" });

    return finish(deps, options, conversationId, "sent");
  }

  await insertMessage(deps.db, {
    conversationId,
    direction: "outbound",
    sender: "bot",
    text: result.decision.draft.length > 0 ? result.decision.draft : null,
    isDraft: true,
    aiMetadata,
  });

  return handOff(deps, {
    pageId: page.id,
    conversationId,
    reason: result.decision.reason,
    draft: result.decision.draft,
  });
}

async function refreshSummary(
  deps: WorkerDeps,
  messageCount: number,
  conversationId: string,
  pageName: string,
): Promise<void> {
  if (!shouldRefreshSummary(messageCount)) {
    return;
  }

  try {
    const rows = await listRecentMessages(deps.db, conversationId, 40);
    const history: ReplyTurn[] = rows
      .filter((row) => (row.text ?? "").trim().length > 0 && !row.isDraft)
      .map((row) => ({ role: row.sender, text: row.text ?? "" }));

    const summary = await summarizeConversation(deps.llm, { pageName, history });
    await setConversationSummary(deps.db, conversationId, summary);
  } catch (error) {
    // A missing summary must never cost the customer a reply.
    console.warn("[worker] could not refresh the conversation summary", error);
  }
}

async function handOff(
  deps: WorkerDeps,
  input: { pageId: string; conversationId: string; reason: string; draft: string | null },
): Promise<ReplyJobResult> {
  await setConversationMode(deps.db, input.conversationId, "human", input.reason);
  await notifyInbox(deps.db, {
    conversationId: input.conversationId,
    pageId: input.pageId,
    kind: "handoff",
    reason: input.reason,
  });

  return { conversationId: input.conversationId, action: "handoff", reason: input.reason };
}

async function finish(
  deps: WorkerDeps,
  options: ReplyJobOptions,
  conversationId: string,
  action: "sent" | "handoff",
): Promise<ReplyJobResult> {
  // A message that arrived while this job was running deserves its own turn.
  const remaining = await listPendingInboundMessages(deps.db, conversationId);

  if (remaining.length > 0) {
    await options.enqueueReply(conversationId);
    return { conversationId, action: "requeued" };
  }

  return { conversationId, action };
}
