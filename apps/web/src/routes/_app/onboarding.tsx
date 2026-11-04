import { Badge } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { Link } from "@astryxdesign/core/Link";
import { Section } from "@astryxdesign/core/Section";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  approveAllProducts,
  knowledgeSummaryQueryOptions,
  resyncPage,
} from "../../features/knowledge/api.ts";
import { pagesQueryOptions } from "../../features/pages/api.ts";
import { Page } from "../../lib/page.tsx";

export const Route = createFileRoute("/_app/onboarding")({
  loader: ({ context }) => context.queryClient.ensureQueryData(pagesQueryOptions),
  component: OnboardingPage,
});

function Step({ index, title, body }: { index: number; title: string; body: string }) {
  return (
    <HStack align="start" gap={3}>
      <Badge label={String(index)} variant="info" />
      <VStack gap={0.5}>
        <Text type="label">{title}</Text>
        <Text type="supporting">{body}</Text>
      </VStack>
    </HStack>
  );
}

function OnboardingPage() {
  const queryClient = useQueryClient();
  const pages = useQuery(pagesQueryOptions);
  const summary = useQuery(knowledgeSummaryQueryOptions());

  const connected = pages.data ?? [];
  const [page] = connected;
  const hasPage = Boolean(page);

  const resync = useMutation({
    mutationFn: (pageId: string) => resyncPage(pageId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["knowledge-summary"] });
    },
  });

  const approve = useMutation({
    mutationFn: () => approveAllProducts(undefined),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["products"] });
      await queryClient.invalidateQueries({ queryKey: ["knowledge-summary"] });
    },
  });

  return (
    <Page
      title="Get live"
      description="Four steps between connecting a Page and letting the bot answer."
    >
      <Section>
        <VStack gap={5}>
          <Step
            index={1}
            title="Connect your Facebook Page"
            body={
              hasPage
                ? `${page?.name} is connected.`
                : "Sign in with Facebook and choose the Page the bot should answer for."
            }
          />
          {hasPage ? null : <Link href="/pages">Go to Pages</Link>}

          <Step
            index={2}
            title="Sync the Page knowledge"
            body={
              summary.data?.lastSyncedAt
                ? `Last synced ${new Date(summary.data.lastSyncedAt).toLocaleString()} · ${summary.data.posts} posts · ${summary.data.chunks} chunks indexed`
                : "Fetch the profile and the posts from the last six months, then extract the products."
            }
          />
          {hasPage ? (
            <Button
              label="Sync now"
              size="sm"
              variant="secondary"
              isLoading={resync.isPending}
              onClick={() => page && resync.mutate(page.id)}
            />
          ) : null}

          <Step
            index={3}
            title="Review the extracted products"
            body={
              summary.data
                ? `${summary.data.draftProducts} draft product${summary.data.draftProducts === 1 ? "" : "s"} waiting. Drafts are not quoted until you approve them.`
                : "Products the model found in your posts stay as drafts until you approve them."
            }
          />
          <HStack align="center" gap={2}>
            <Link href="/products">Review products</Link>
            {summary.data && summary.data.draftProducts > 0 ? (
              <Button
                label="Approve all"
                size="sm"
                variant="secondary"
                isLoading={approve.isPending}
                onClick={() => approve.mutate()}
              />
            ) : null}
          </HStack>

          <Step
            index={4}
            title="Add your policies and FAQs"
            body="Delivery charges, cash on delivery and returns are the questions the bot must not guess at."
          />
          <Link href="/knowledge">Go to Knowledge</Link>
        </VStack>
      </Section>

      {summary.data ? (
        <HStack align="center" gap={3}>
          <Badge label={`${summary.data.products} products`} variant="neutral" />
          <Badge label={`${summary.data.faqs} FAQs`} variant="neutral" />
          <Badge label={`${summary.data.policies} policies`} variant="neutral" />
          <Badge label={`${summary.data.documents} documents`} variant="neutral" />
          <Badge label={`${summary.data.chunks} chunks`} variant="neutral" />
        </HStack>
      ) : null}
    </Page>
  );
}
