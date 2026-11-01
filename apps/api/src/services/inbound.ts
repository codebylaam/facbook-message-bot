import {
  type Db,
  findConversationForCustomer,
  findOrCreateConversation,
  findOrCreateCustomer,
  findPageByFbPageId,
  insertMessage,
  midExists,
  recordInboundMessage,
  setConversationMode,
} from "@fb-bot/db";
import type { WebhookEntry } from "@fb-bot/meta";

export type InboundDeps = {
  db: Db;
  enqueueReply: (conversationId: string) => Promise<void>;
};

export type InboundResult = {
  stored: number;
  enqueued: number;
  echoes: number;
  duplicates: number;
  skipped: number;
  reason?: string;
};

export async function handleMessageEntry(
  deps: InboundDeps,
  entry: WebhookEntry,
): Promise<InboundResult> {
  const result: InboundResult = {
    stored: 0,
    enqueued: 0,
    echoes: 0,
    duplicates: 0,
    skipped: 0,
  };

  const page = await findPageByFbPageId(deps.db, entry.id);

  if (!page) {
    return { ...result, skipped: 1, reason: "the page is not connected to this app" };
  }

  for (const event of entry.messaging ?? []) {
    const message = event.message;

    if (!message) {
      result.skipped += 1;
      continue;
    }

    const isEcho = message.is_echo === true;

    // An echo comes from the page itself, so the customer is the recipient.
    const customerPsid = isEcho ? event.recipient.id : event.sender.id;

    if (customerPsid === entry.id) {
      result.skipped += 1;
      continue;
    }

    if (message.mid && (await midExists(deps.db, message.mid))) {
      result.duplicates += 1;
      continue;
    }

    const customer = await findOrCreateCustomer(deps.db, page.id, customerPsid);

    if (!customer) {
      result.skipped += 1;
      continue;
    }

    const conversation = await findOrCreateConversation(deps.db, page.id, customer.id);

    if (!conversation) {
      result.skipped += 1;
      continue;
    }

    if (isEcho) {
      await insertMessage(deps.db, {
        conversationId: conversation.id,
        mid: message.mid,
        direction: "outbound",
        sender: "human",
        text: message.text ?? null,
        isEcho: true,
      });

      // The seller answered by hand, so the bot should step back.
      if (conversation.mode === "bot") {
        await setConversationMode(
          deps.db,
          conversation.id,
          "human",
          "The seller replied from the Page inbox",
        );
      }

      result.echoes += 1;
      continue;
    }

    const stored = await insertMessage(deps.db, {
      conversationId: conversation.id,
      mid: message.mid,
      direction: "inbound",
      sender: "customer",
      text: message.text ?? null,
      attachments: (message.attachments ?? []).map((attachment) => ({
        type: attachment.type,
        url: attachment.payload?.url,
      })),
    });

    if (!stored) {
      result.duplicates += 1;
      continue;
    }

    await recordInboundMessage(deps.db, conversation.id);
    await deps.enqueueReply(conversation.id);

    result.stored += 1;
    result.enqueued += 1;
  }

  return result;
}

export async function conversationIdForPageAndPsid(
  db: Db,
  fbPageId: string,
  psid: string,
): Promise<string | null> {
  const page = await findPageByFbPageId(db, fbPageId);

  if (!page) {
    return null;
  }

  const customer = await findOrCreateCustomer(db, page.id, psid);

  if (!customer) {
    return null;
  }

  const conversation = await findConversationForCustomer(db, page.id, customer.id);

  return conversation?.id ?? null;
}
