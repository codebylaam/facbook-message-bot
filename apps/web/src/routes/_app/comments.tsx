import { Badge } from "@astryxdesign/core/Badge";
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Selector } from "@astryxdesign/core/Selector";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import type { Comment } from "@fb-bot/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  type CommentStatus,
  commentsQueryOptions,
  updatePageCommentMode,
} from "../../features/comments/api.ts";
import { pagesQueryOptions } from "../../features/pages/api.ts";
import { getApiErrorMessage } from "../../lib/api/errors.ts";

export const Route = createFileRoute("/_app/comments")({
  loader: ({ context }) => context.queryClient.ensureQueryData(commentsQueryOptions("flagged")),
  component: CommentsPage,
});

const FILTERS: { value: CommentStatus | "all"; label: string }[] = [
  { value: "flagged", label: "Flagged" },
  { value: "all", label: "All" },
  { value: "private_replied", label: "Private reply" },
  { value: "public_replied", label: "Private + public" },
  { value: "ignored", label: "Ignored" },
];

const COMMENT_MODE_OPTIONS = [
  { value: "off", label: "Off, no automatic comment replies" },
  { value: "private", label: "Private reply only" },
  { value: "private_public", label: "Private reply plus a public line" },
];

const STATUS_BADGE: Record<
  Comment["replyStatus"],
  { variant: "success" | "warning" | "neutral" | "info" | "error"; label: string }
> = {
  flagged: { variant: "warning", label: "Needs you" },
  private_replied: { variant: "success", label: "Private reply" },
  public_replied: { variant: "success", label: "Private + public" },
  pending: { variant: "info", label: "Queued" },
  ignored: { variant: "neutral", label: "Ignored" },
};

const CLASSIFICATION_LABEL: Record<string, string> = {
  price_question: "Price question",
  order_intent: "Order intent",
  complaint: "Complaint",
  spam: "Spam",
  other: "Other",
};

function CommentsPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<CommentStatus | "all">("flagged");
  const [error, setError] = useState<string | null>(null);

  const comments = useQuery(commentsQueryOptions(filter));
  const pages = useQuery(pagesQueryOptions);
  const page = (pages.data ?? [])[0];

  const modeMutation = useMutation({
    mutationFn: (mode: "off" | "private" | "private_public") =>
      updatePageCommentMode(page?.id ?? "", mode),
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ["pages"] });
    },
    onError: (thrown: unknown) => setError(getApiErrorMessage(thrown)),
  });

  const rows = comments.data ?? [];

  return (
    <VStack gap={6}>
      <VStack gap={1}>
        <Heading level={1}>Comments</Heading>
        <Text type="supporting">
          Post comments the bot answered privately, and the ones it left for you.
        </Text>
      </VStack>

      {page ? (
        <Card>
          <HStack align="center" gap={3} justify="between">
            <VStack gap={0.5}>
              <Text type="label">Comment replies on {page.name}</Text>
              <Text type="supporting">
                A private reply opens a DM with the commenter. The public line is posted on the
                post.
              </Text>
            </VStack>

            <VStack width={280}>
              <Selector
                label="Comment mode"
                options={COMMENT_MODE_OPTIONS}
                value={page.commentMode}
                onChange={(value) =>
                  modeMutation.mutate(value as "off" | "private" | "private_public")
                }
                isDisabled={modeMutation.isPending}
              />
            </VStack>
          </HStack>
        </Card>
      ) : null}

      {error ? <Banner status="error" title={error} /> : null}

      <HStack align="center" gap={2}>
        {FILTERS.map((option) => (
          <Button
            key={option.value}
            label={option.label}
            size="sm"
            variant={filter === option.value ? "primary" : "secondary"}
            onClick={() => setFilter(option.value)}
          />
        ))}
      </HStack>

      {rows.length === 0 ? (
        <EmptyState
          title="No comments here"
          description={
            filter === "flagged"
              ? "Nothing needs a human. Complaints and uncertain answers land here."
              : "No comments match this filter yet."
          }
        />
      ) : (
        <VStack gap={2}>
          {rows.map((comment) => {
            const badge = STATUS_BADGE[comment.replyStatus];

            return (
              <Card key={comment.id}>
                <VStack gap={2}>
                  <HStack align="center" gap={2}>
                    <Badge label={badge.label} variant={badge.variant} />
                    {comment.classification ? (
                      <Badge
                        label={
                          CLASSIFICATION_LABEL[comment.classification] ?? comment.classification
                        }
                        variant="neutral"
                      />
                    ) : null}
                    <Text type="supporting">
                      {comment.customerName ?? "someone"} ·{" "}
                      {new Date(comment.createdAt).toLocaleString()}
                    </Text>
                  </HStack>

                  <Text>{comment.text ?? "(no text)"}</Text>

                  {comment.replyStatus === "flagged" ? (
                    <Text type="supporting">
                      Open the post on Facebook to answer, or hand the Page back to the bot once
                      done.
                    </Text>
                  ) : null}
                </VStack>
              </Card>
            );
          })}
        </VStack>
      )}
    </VStack>
  );
}
