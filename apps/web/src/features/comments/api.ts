import type { Comment } from "@fb-bot/shared";
import { queryOptions } from "@tanstack/react-query";
import { api } from "../../lib/api/client.ts";

export const COMMENT_STATUSES = [
  "flagged",
  "private_replied",
  "public_replied",
  "pending",
  "ignored",
] as const;

export type CommentStatus = (typeof COMMENT_STATUSES)[number];

export const commentsQueryOptions = (status: CommentStatus | "all") =>
  queryOptions({
    queryKey: ["comments", status] as const,
    queryFn: async (): Promise<Comment[]> => {
      const response = await api.get<{ comments: Comment[] }>("/api/comments", {
        params: status === "all" ? undefined : { status },
      });

      return response.data.comments;
    },
  });

export async function updatePageCommentMode(
  pageId: string,
  commentMode: "off" | "private" | "private_public",
) {
  await api.patch(`/api/pages/${pageId}/settings`, { commentMode });
}
