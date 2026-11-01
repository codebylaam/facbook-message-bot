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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import {
  createFaq,
  createPolicy,
  deleteFaq,
  deletePolicy,
  faqsQueryOptions,
  knowledgeSummaryQueryOptions,
  policiesQueryOptions,
  postsQueryOptions,
  setPostIncluded,
} from "../../features/knowledge/api.ts";
import { getApiErrorMessage } from "../../lib/api/errors.ts";
import { useAppForm } from "../../lib/form/index.ts";

export const Route = createFileRoute("/_app/knowledge")({
  loader: ({ context }) => context.queryClient.ensureQueryData(faqsQueryOptions()),
  component: KnowledgePage,
});

const faqFormSchema = z.object({
  question: z.string().min(1, "A question is required"),
  answer: z.string().min(1, "An answer is required"),
});

const policyFormSchema = z.object({
  title: z.string().min(1, "A title is required"),
  content: z.string().min(1, "Some content is required"),
});

function FaqForm({ onDone }: { onDone: () => void }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (values: z.infer<typeof faqFormSchema>) => createFaq(undefined, values),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["faqs"] });
      await queryClient.invalidateQueries({ queryKey: ["knowledge-summary"] });
      onDone();
    },
  });

  const form = useAppForm({
    defaultValues: { question: "", answer: "" },
    validators: { onChange: faqFormSchema, onSubmit: faqFormSchema },
    onSubmit: async ({ value }) => {
      setError(null);
      try {
        await mutation.mutateAsync(value);
      } catch (thrown: unknown) {
        setError(getApiErrorMessage(thrown));
      }
    },
  });

  return (
    <VStack gap={4}>
      {error ? <Banner container="card" status="error" title={error} /> : null}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
      >
        <VStack gap={4}>
          <form.AppField name="question">
            {(field) => <field.TextField label="Question" placeholder="ঢাকার বাইরে ডেলিভারি চার্জ কত?" />}
          </form.AppField>
          <form.AppField name="answer">
            {(field) => (
              <field.TextAreaField label="Answer" rows={3} placeholder="ঢাকার বাইরে ১২০ টাকা।" />
            )}
          </form.AppField>
          <HStack align="center" gap={2}>
            <form.AppForm>
              <form.SubmitButton label="Add FAQ" size="md" />
            </form.AppForm>
            <Button label="Cancel" size="md" variant="secondary" onClick={onDone} />
          </HStack>
        </VStack>
      </form>
    </VStack>
  );
}

function PolicyForm({ onDone }: { onDone: () => void }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (values: z.infer<typeof policyFormSchema>) => createPolicy(undefined, values),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["policies"] });
      await queryClient.invalidateQueries({ queryKey: ["knowledge-summary"] });
      onDone();
    },
  });

  const form = useAppForm({
    defaultValues: { title: "", content: "" },
    validators: { onChange: policyFormSchema, onSubmit: policyFormSchema },
    onSubmit: async ({ value }) => {
      setError(null);
      try {
        await mutation.mutateAsync(value);
      } catch (thrown: unknown) {
        setError(getApiErrorMessage(thrown));
      }
    },
  });

  return (
    <VStack gap={4}>
      {error ? <Banner container="card" status="error" title={error} /> : null}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
      >
        <VStack gap={4}>
          <form.AppField name="title">
            {(field) => <field.TextField label="Title" placeholder="Delivery and returns" />}
          </form.AppField>
          <form.AppField name="content">
            {(field) => (
              <field.TextAreaField
                label="Policy"
                rows={4}
                placeholder="ঢাকার ভিতরে ৬০ টাকা, বাইরে ১২০ টাকা। ক্যাশ অন ডেলিভারি আছে।"
              />
            )}
          </form.AppField>
          <HStack align="center" gap={2}>
            <form.AppForm>
              <form.SubmitButton label="Add policy" size="md" />
            </form.AppForm>
            <Button label="Cancel" size="md" variant="secondary" onClick={onDone} />
          </HStack>
        </VStack>
      </form>
    </VStack>
  );
}

function KnowledgePage() {
  const queryClient = useQueryClient();
  const faqs = useQuery(faqsQueryOptions());
  const policies = useQuery(policiesQueryOptions());
  const posts = useQuery(postsQueryOptions());
  const summary = useQuery(knowledgeSummaryQueryOptions());

  const [showFaqForm, setShowFaqForm] = useState(false);
  const [showPolicyForm, setShowPolicyForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["faqs"] });
    await queryClient.invalidateQueries({ queryKey: ["policies"] });
    await queryClient.invalidateQueries({ queryKey: ["posts"] });
    await queryClient.invalidateQueries({ queryKey: ["knowledge-summary"] });
  };

  const removeFaq = useMutation({
    mutationFn: (faqId: string) => deleteFaq(undefined, faqId),
    onSuccess: refresh,
  });

  const removePolicy = useMutation({
    mutationFn: (policyId: string) => deletePolicy(undefined, policyId),
    onSuccess: refresh,
  });

  const togglePost = useMutation({
    mutationFn: ({ postId, included }: { postId: string; included: boolean }) =>
      setPostIncluded(undefined, postId, included),
    onSuccess: refresh,
  });

  const needsPage = summary.isError;

  if (needsPage) {
    return (
      <VStack gap={6}>
        <Heading level={1}>Knowledge</Heading>
        <EmptyState
          title="Connect a Page first"
          description="The bot learns from the Page profile, its posts, your FAQs and your policies."
        />
      </VStack>
    );
  }

  return (
    <VStack gap={6}>
      <VStack gap={1}>
        <Heading level={1}>Knowledge</Heading>
        <Text type="supporting">
          What the bot is allowed to answer from. Anything missing here is handed to you.
        </Text>
      </VStack>

      {error ? <Banner container="card" status="error" title={error} /> : null}

      {summary.data ? (
        <Grid columns={{ minWidth: 180, max: 3 }} gap={3}>
          <Card>
            <VStack gap={0.5}>
              <Text type="label">Indexed chunks</Text>
              <Text type="supporting">
                {summary.data.chunks === 0
                  ? "Nothing indexed yet"
                  : `${summary.data.chunks - summary.data.unembeddedChunks} of ${summary.data.chunks} embedded`}
              </Text>
            </VStack>
          </Card>
          <Card>
            <VStack gap={0.5}>
              <Text type="label">Posts</Text>
              <Text type="supporting">{summary.data.posts} synced from the Page</Text>
            </VStack>
          </Card>
          <Card>
            <VStack gap={0.5}>
              <Text type="label">Last sync</Text>
              <Text type="supporting">
                {summary.data.lastSyncedAt
                  ? new Date(summary.data.lastSyncedAt).toLocaleString()
                  : "not synced yet"}
              </Text>
            </VStack>
          </Card>
        </Grid>
      ) : null}

      <VStack gap={3}>
        <HStack align="center" gap={3} justify="between">
          <Heading level={2}>FAQs</Heading>
          <Button
            label="Add FAQ"
            size="sm"
            isDisabled={showFaqForm}
            onClick={() => setShowFaqForm(true)}
          />
        </HStack>

        {showFaqForm ? (
          <Card>
            <FaqForm onDone={() => setShowFaqForm(false)} />
          </Card>
        ) : null}

        {(faqs.data?.faqs ?? []).length === 0 ? (
          <Text type="supporting">No FAQs yet. Add the questions customers keep asking.</Text>
        ) : (
          (faqs.data?.faqs ?? []).map((faq) => (
            <Card key={faq.id}>
              <HStack align="center" gap={3} justify="between">
                <VStack gap={0.5}>
                  <Text type="label">{faq.question}</Text>
                  <Text type="supporting">{faq.answer}</Text>
                </VStack>
                <Button
                  label="Delete"
                  size="sm"
                  variant="secondary"
                  isLoading={removeFaq.isPending}
                  onClick={() =>
                    removeFaq.mutate(faq.id, {
                      onError: (thrown: unknown) => setError(getApiErrorMessage(thrown)),
                    })
                  }
                />
              </HStack>
            </Card>
          ))
        )}
      </VStack>

      <VStack gap={3}>
        <HStack align="center" gap={3} justify="between">
          <Heading level={2}>Policies</Heading>
          <Button
            label="Add policy"
            size="sm"
            isDisabled={showPolicyForm}
            onClick={() => setShowPolicyForm(true)}
          />
        </HStack>

        {showPolicyForm ? (
          <Card>
            <PolicyForm onDone={() => setShowPolicyForm(false)} />
          </Card>
        ) : null}

        {(policies.data?.policies ?? []).length === 0 ? (
          <Text type="supporting">
            No policies yet. Delivery charges, cash on delivery and returns belong here.
          </Text>
        ) : (
          (policies.data?.policies ?? []).map((policy) => (
            <Card key={policy.id}>
              <HStack align="center" gap={3} justify="between">
                <VStack gap={0.5}>
                  <Text type="label">{policy.title}</Text>
                  <Text type="supporting" maxLines={3}>
                    {policy.content}
                  </Text>
                </VStack>
                <Button
                  label="Delete"
                  size="sm"
                  variant="secondary"
                  isLoading={removePolicy.isPending}
                  onClick={() =>
                    removePolicy.mutate(policy.id, {
                      onError: (thrown: unknown) => setError(getApiErrorMessage(thrown)),
                    })
                  }
                />
              </HStack>
            </Card>
          ))
        )}
      </VStack>

      <VStack gap={3}>
        <HStack align="center" gap={3} justify="between">
          <Heading level={2}>Posts</Heading>
          <Text type="supporting">Excluded posts are not embedded and not used to answer.</Text>
        </HStack>

        {(posts.data?.posts ?? []).length === 0 ? (
          <Text type="supporting">No posts synced yet. Run a resync from the Pages screen.</Text>
        ) : (
          (posts.data?.posts ?? []).map((post) => (
            <Card key={post.id}>
              <HStack align="center" gap={3} justify="between">
                <VStack gap={0.5}>
                  <Text type="label" maxLines={2}>
                    {post.message ?? "(image only post)"}
                  </Text>
                  <HStack align="center" gap={2}>
                    <Badge
                      label={post.included ? "Included" : "Excluded"}
                      variant={post.included ? "success" : "neutral"}
                    />
                    {post.fbCreatedTime ? (
                      <Text type="supporting">
                        {new Date(post.fbCreatedTime).toLocaleDateString()}
                      </Text>
                    ) : null}
                  </HStack>
                </VStack>
                <Button
                  label={post.included ? "Exclude" : "Include"}
                  size="sm"
                  variant="secondary"
                  isLoading={togglePost.isPending}
                  onClick={() =>
                    togglePost.mutate(
                      { postId: post.id, included: !post.included },
                      { onError: (thrown: unknown) => setError(getApiErrorMessage(thrown)) },
                    )
                  }
                />
              </HStack>
            </Card>
          ))
        )}
      </VStack>
    </VStack>
  );
}
