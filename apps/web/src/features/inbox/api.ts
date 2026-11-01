import type {
  Conversation,
  ConversationFilter,
  InboxMessage,
  SendMessageInput,
} from "@fb-bot/shared";
import { queryOptions } from "@tanstack/react-query";
import { api } from "../../lib/api/client.ts";

export const conversationsQueryOptions = (filter: ConversationFilter) =>
  queryOptions({
    queryKey: ["conversations", filter] as const,
    queryFn: async (): Promise<{ conversations: Conversation[]; total: number }> => {
      const response = await api.get<{ conversations: Conversation[]; total: number }>(
        "/api/conversations",
        { params: { filter } },
      );
      return response.data;
    },
  });

export const conversationQueryOptions = (conversationId: string | null) =>
  queryOptions({
    queryKey: ["conversation", conversationId] as const,
    enabled: conversationId !== null,
    queryFn: async (): Promise<{ conversation: Conversation; messages: InboxMessage[] } | null> => {
      if (!conversationId) {
        return null;
      }

      const response = await api.get<{ conversation: Conversation; messages: InboxMessage[] }>(
        `/api/conversations/${conversationId}`,
      );

      return response.data;
    },
  });

export async function sendReply(conversationId: string, input: SendMessageInput) {
  const response = await api.post<{ message: InboxMessage }>(
    `/api/conversations/${conversationId}/messages`,
    input,
  );
  return response.data.message;
}

export async function saveDraft(conversationId: string, draftId: string, text: string) {
  await api.patch(`/api/conversations/${conversationId}/drafts/${draftId}`, { text });
}

export async function approveDraft(conversationId: string, draftId: string) {
  const response = await api.post<{ message: InboxMessage }>(
    `/api/conversations/${conversationId}/drafts/${draftId}/approve`,
  );
  return response.data.message;
}

export async function discardDrafts(conversationId: string) {
  await api.delete(`/api/conversations/${conversationId}/drafts`);
}

export async function setConversationMode(conversationId: string, mode: "bot" | "human") {
  const action = mode === "bot" ? "handback" : "takeover";
  await api.post(`/api/conversations/${conversationId}/${action}`);
}

export async function markConversationRead(conversationId: string) {
  await api.post(`/api/conversations/${conversationId}/read`);
}
