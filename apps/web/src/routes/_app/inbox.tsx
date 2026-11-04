import { Badge } from "@astryxdesign/core/Badge";
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Grid } from "@astryxdesign/core/Grid";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import {
  type Conversation,
  type ConversationFilter,
  type InboxMessage,
  sendMessageSchema,
  updateDraftSchema,
} from "@fb-bot/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  approveDraft,
  conversationQueryOptions,
  conversationsQueryOptions,
  discardDrafts,
  markConversationRead,
  saveDraft,
  sendReply,
  setConversationMode,
} from "../../features/inbox/api.ts";
import { useInboxEvents } from "../../features/inbox/use-inbox-events.ts";
import { getApiErrorMessage } from "../../lib/api/errors.ts";
import { useAppForm } from "../../lib/form/index.ts";
import { Page } from "../../lib/page.tsx";

export const Route = createFileRoute("/_app/inbox")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(conversationsQueryOptions("needs_attention")),
  component: InboxPage,
});

const FILTERS: { value: ConversationFilter; label: string }[] = [
  { value: "needs_attention", label: "Needs attention" },
  { value: "all", label: "All" },
  { value: "human", label: "Human" },
  { value: "bot", label: "Bot" },
];

const MODE_BADGE = {
  bot: { variant: "info" as const, label: "Bot" },
  human: { variant: "warning" as const, label: "Human" },
  paused: { variant: "neutral" as const, label: "Paused" },
};

function formatTime(value: string | null): string {
  if (!value) {
    return "";
  }

  return new Date(value).toLocaleString();
}

function Composer({ conversationId, onSent }: { conversationId: string; onSent: () => void }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (text: string) => sendReply(conversationId, { text }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["conversation"] });
      await queryClient.invalidateQueries({ queryKey: ["conversations"] });
      onSent();
    },
  });

  const form = useAppForm({
    defaultValues: { text: "" },
    validators: { onChange: sendMessageSchema, onSubmit: sendMessageSchema },
    onSubmit: async ({ value }) => {
      setError(null);

      try {
        await mutation.mutateAsync(value.text);
        form.reset();
      } catch (thrown: unknown) {
        setError(getApiErrorMessage(thrown));
      }
    },
  });

  return (
    <VStack gap={2}>
      {error ? <Banner container="card" status="error" title={error} /> : null}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
      >
        <VStack gap={2}>
          <form.AppField name="text">
            {(field) => (
              <field.TextAreaField label="Reply as yourself" rows={3} placeholder="Type a reply" />
            )}
          </form.AppField>
          <form.AppForm>
            <form.SubmitButton label="Send reply" size="md" />
          </form.AppForm>
        </VStack>
      </form>
    </VStack>
  );
}

function DraftCard({ conversationId, draft }: { conversationId: string; draft: InboxMessage }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["conversation"] });
    await queryClient.invalidateQueries({ queryKey: ["conversations"] });
  };

  const save = useMutation({
    mutationFn: (text: string) => saveDraft(conversationId, draft.id, text),
    onSuccess: invalidate,
  });

  const approve = useMutation({
    mutationFn: () => approveDraft(conversationId, draft.id),
    onSuccess: invalidate,
  });

  const discard = useMutation({
    mutationFn: () => discardDrafts(conversationId),
    onSuccess: invalidate,
  });

  const form = useAppForm({
    defaultValues: { text: draft.text ?? "" },
    validators: { onChange: updateDraftSchema, onSubmit: updateDraftSchema },
    onSubmit: async ({ value }) => {
      setError(null);

      try {
        await save.mutateAsync(value.text);
      } catch (thrown: unknown) {
        setError(getApiErrorMessage(thrown));
      }
    },
  });

  return (
    <Card variant="muted">
      <VStack gap={3}>
        <HStack align="center" gap={2}>
          <Badge label="Draft" variant="warning" />
          {draft.confidence !== null ? (
            <Text type="supporting">confidence {draft.confidence.toFixed(2)}</Text>
          ) : null}
          {draft.intent ? <Badge label={draft.intent} variant="neutral" /> : null}
        </HStack>

        {error ? <Banner container="card" status="error" title={error} /> : null}

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
        >
          <VStack gap={3}>
            <form.AppField name="text">
              {(field) => (
                <field.TextAreaField
                  label="The bot wrote this but was not sure"
                  rows={3}
                  placeholder="Edit before sending"
                />
              )}
            </form.AppField>

            <HStack align="center" gap={2}>
              <Button
                label="Approve and send"
                size="sm"
                isLoading={approve.isPending}
                onClick={() => approve.mutate()}
              />
              <Button
                label="Save edit"
                size="sm"
                variant="secondary"
                isLoading={save.isPending}
                onClick={() => void form.handleSubmit()}
              />
              <Button
                label="Discard"
                size="sm"
                variant="secondary"
                isLoading={discard.isPending}
                onClick={() => discard.mutate()}
              />
            </HStack>
          </VStack>
        </form>
      </VStack>
    </Card>
  );
}

function MessageCard({
  message,
  conversationId,
}: {
  message: InboxMessage;
  conversationId: string;
}) {
  if (message.isDraft) {
    return <DraftCard conversationId={conversationId} draft={message} />;
  }

  const isCustomer = message.sender === "customer";
  const label = isCustomer ? "Customer" : message.sender === "bot" ? "Bot" : "You";

  return (
    <Card variant={isCustomer ? "default" : "muted"}>
      <VStack gap={1}>
        <HStack align="center" gap={2}>
          <Badge label={label} variant={isCustomer ? "neutral" : "info"} />
          <Text type="supporting">{formatTime(message.createdAt)}</Text>
          {message.confidence !== null ? (
            <Text type="supporting">confidence {message.confidence.toFixed(2)}</Text>
          ) : null}
        </HStack>
        <Text>{message.text ?? "(attachment)"}</Text>
      </VStack>
    </Card>
  );
}

function Thread({ conversationId }: { conversationId: string }) {
  const queryClient = useQueryClient();
  const thread = useQuery(conversationQueryOptions(conversationId));
  const [error, setError] = useState<string | null>(null);

  const modeMutation = useMutation({
    mutationFn: (mode: "bot" | "human") => setConversationMode(conversationId, mode),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["conversation"] });
      await queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });

  const conversation = thread.data?.conversation;

  if (!conversation) {
    return <Text type="supporting">Loading the conversation…</Text>;
  }

  return (
    <VStack gap={4}>
      <HStack align="center" gap={3} justify="between">
        <VStack gap={0.5}>
          <Heading level={2}>{conversation.customerName ?? conversation.customerPsid}</Heading>
          <Text type="supporting">
            {conversation.mode === "human"
              ? (conversation.handoffReason ?? "A human owns this conversation")
              : conversation.mode === "bot"
                ? "The bot answers here"
                : "Paused"}
          </Text>
        </VStack>

        <HStack align="center" gap={2}>
          <Button
            label="Take over"
            size="sm"
            variant={conversation.mode === "human" ? "primary" : "secondary"}
            isLoading={modeMutation.isPending}
            onClick={() => modeMutation.mutate("human")}
          />
          <Button
            label="Hand back to bot"
            size="sm"
            variant="secondary"
            isLoading={modeMutation.isPending}
            onClick={() => modeMutation.mutate("bot")}
          />
        </HStack>
      </HStack>

      {conversation.summary ? <Text type="supporting">Summary: {conversation.summary}</Text> : null}

      {error ? <Banner container="card" status="error" title={error} /> : null}

      <VStack gap={2}>
        {(thread.data?.messages ?? []).map((message) => (
          <MessageCard key={message.id} message={message} conversationId={conversationId} />
        ))}
      </VStack>

      <Composer conversationId={conversationId} onSent={() => setError(null)} />
    </VStack>
  );
}

function InboxPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<ConversationFilter>("needs_attention");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useInboxEvents(queryClient);

  const conversations = useQuery(conversationsQueryOptions(filter));
  const rows = conversations.data?.conversations ?? [];

  const select = (conversation: Conversation) => {
    setSelectedId(conversation.id);

    if (conversation.unreadCount > 0) {
      void markConversationRead(conversation.id).then(() => {
        void queryClient.invalidateQueries({ queryKey: ["conversations"] });
        void queryClient.invalidateQueries({ queryKey: ["conversation"] });
      });
    }
  };

  return (
    <Page
      title="Inbox"
      description="Every conversation, live. A draft means the bot was not confident enough to answer."
      contentWidth={1200}
    >
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
        <Text type="supporting">{conversations.data?.total ?? 0} conversations</Text>
      </HStack>

      <Grid columns={{ minWidth: 320, max: 2 }} gap={4}>
        <VStack gap={2}>
          {rows.length === 0 ? (
            <EmptyState
              title="Nothing here"
              description={
                filter === "needs_attention"
                  ? "No unread conversations. The bot is handling the rest."
                  : "No conversations match this filter yet."
              }
              isCompact
            />
          ) : (
            rows.map((conversation) => {
              const badge = MODE_BADGE[conversation.mode];

              return (
                <Card
                  key={conversation.id}
                  variant={selectedId === conversation.id ? "muted" : "default"}
                >
                  <VStack gap={1}>
                    <HStack align="center" gap={2} justify="between">
                      <Text type="label" maxLines={1}>
                        {conversation.customerName ?? conversation.customerPsid}
                      </Text>
                      {conversation.unreadCount > 0 ? (
                        <Badge label={`${conversation.unreadCount} new`} variant="error" />
                      ) : null}
                    </HStack>

                    <Text type="supporting" maxLines={1}>
                      {conversation.summary ??
                        conversation.handoffReason ??
                        `${conversation.messageCount} messages`}
                    </Text>

                    <HStack align="center" gap={2}>
                      <Badge label={badge.label} variant={badge.variant} />
                      {conversation.hasDraft ? <Badge label="Draft" variant="warning" /> : null}
                      <Text type="supporting">{formatTime(conversation.lastMessageAt)}</Text>
                    </HStack>

                    <Button
                      label="Open"
                      size="sm"
                      variant="secondary"
                      onClick={() => select(conversation)}
                    />
                  </VStack>
                </Card>
              );
            })
          )}
        </VStack>

        <VStack gap={3}>
          {selectedId ? (
            <Thread key={selectedId} conversationId={selectedId} />
          ) : (
            <EmptyState
              title="Pick a conversation"
              description="The thread, the draft and the takeover controls appear here."
            />
          )}
        </VStack>
      </Grid>
    </Page>
  );
}
