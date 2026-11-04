import { Badge } from "@astryxdesign/core/Badge";
import { Card } from "@astryxdesign/core/Card";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Grid } from "@astryxdesign/core/Grid";
import { Heading } from "@astryxdesign/core/Heading";
import { Link } from "@astryxdesign/core/Link";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import type { Dashboard, Lead } from "@fb-bot/shared";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { api } from "../../lib/api/client.ts";
import { Page } from "../../lib/page.tsx";

const dashboardQueryOptions = queryOptions({
  queryKey: ["dashboard"] as const,
  queryFn: async (): Promise<Dashboard> => {
    const response = await api.get<Dashboard>("/api/dashboard");
    return response.data;
  },
});

const leadsQueryOptions = queryOptions({
  queryKey: ["leads"] as const,
  queryFn: async (): Promise<Lead[]> => {
    const response = await api.get<{ leads: Lead[] }>("/api/leads");
    return response.data.leads;
  },
});

export const Route = createFileRoute("/_app/")({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(dashboardQueryOptions),
      context.queryClient.ensureQueryData(leadsQueryOptions),
    ]),
  component: OverviewPage,
});

function Tile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <Card>
      <VStack gap={0.5}>
        <Text type="label">{label}</Text>
        <Text size="2xl" weight="semibold" hasTabularNumbers>
          {value}
        </Text>
        {note ? <Text type="supporting">{note}</Text> : null}
      </VStack>
    </Card>
  );
}

function OverviewPage() {
  const { session } = Route.useRouteContext();
  const dashboard = useQuery(dashboardQueryOptions);
  const leads = useQuery(leadsQueryOptions);

  const data = dashboard.data;
  const rows = leads.data ?? [];
  const hasNoPage = data?.pageId === null;

  return (
    <Page
      title={`Welcome, ${session.user.name}`}
      description={
        hasNoPage
          ? "Connect a Facebook Page and the bot can start answering."
          : "What the bot has handled for this Page."
      }
    >
      {hasNoPage ? (
        <EmptyState
          title="No Page connected yet"
          description="Sign in with Facebook and pick the Page the bot should answer for."
          actions={<Link href="/pages">Connect a Page</Link>}
        />
      ) : (
        <>
          {data ? (
            <Grid columns={{ minWidth: 200, max: 4 }} gap={3}>
              <Tile
                label="Conversations"
                value={String(data.conversations)}
                note={`${data.inboundMessages} customer messages`}
              />
              <Tile
                label="Auto-reply rate"
                value={`${Math.round(data.autoReplyRate * 100)}%`}
                note={`${data.botMessages} by the bot, ${data.humanMessages} by you`}
              />
              <Tile
                label="With a human"
                value={String(data.inHumanMode)}
                note="handed off or taken over"
              />
              <Tile
                label="Leads"
                value={String(data.leads)}
                note={`${data.usage.used} of ${data.usage.limit} replies used`}
              />
            </Grid>
          ) : null}

          {data && data.draftProducts > 0 ? (
            <Text type="supporting">
              {data.draftProducts} product{data.draftProducts === 1 ? "" : "s"} extracted from posts
              still need a review.
            </Text>
          ) : null}

          <VStack gap={3}>
            <Heading level={2}>Recent leads</Heading>

            {rows.length === 0 ? (
              <EmptyState
                title="No leads yet"
                description="When a customer gives an order detail in a conversation, it lands here."
                isCompact
              />
            ) : (
              <VStack gap={2}>
                {rows.slice(0, 10).map((lead) => (
                  <Card key={lead.id}>
                    <VStack gap={1}>
                      <Text type="label">
                        {lead.name ?? lead.customerName ?? lead.customerPsid}
                      </Text>
                      <Text type="supporting">
                        {lead.phone ?? "no phone"} · {lead.address ?? "no address"}
                      </Text>
                      <Text type="supporting">
                        {lead.items
                          .map((item) => `${item.quantity ?? 1}× ${item.name}`)
                          .join(", ") || "no items"}
                      </Text>
                      <Badge label={lead.status} variant="info" />
                    </VStack>
                  </Card>
                ))}
              </VStack>
            )}
          </VStack>
        </>
      )}
    </Page>
  );
}
