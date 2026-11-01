import { Badge } from "@astryxdesign/core/Badge";
import { Card } from "@astryxdesign/core/Card";
import { Grid } from "@astryxdesign/core/Grid";
import { Heading } from "@astryxdesign/core/Heading";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { api } from "../../lib/api/client.ts";

export const Route = createFileRoute("/_app/")({
  component: OverviewPage,
});

type HealthResponse = {
  status: string;
  uptime: number;
  timestamp: string;
};

const healthQueryOptions = queryOptions({
  queryKey: ["health"] as const,
  queryFn: async (): Promise<HealthResponse> => {
    const response = await api.get<HealthResponse>("/health");
    return response.data;
  },
});

function formatUptime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  if (minutes < 1) return `${Math.round(seconds)}s`;
  const hours = Math.floor(minutes / 60);
  if (hours < 1) return `${minutes}m`;
  return `${hours}h ${minutes % 60}m`;
}

function OverviewPage() {
  const { session } = Route.useRouteContext();
  const health = useQuery(healthQueryOptions);

  return (
    <VStack gap={6}>
      <VStack gap={1}>
        <Heading level={1}>Welcome, {session.user.name}</Heading>
        <Text type="supporting">
          Signed in as {session.user.email} · role {session.user.role}
        </Text>
      </VStack>

      <Grid columns={{ minWidth: 240, max: 3 }} gap={3}>
        <Card>
          <VStack gap={1}>
            <Text type="label">API</Text>
            {health.isPending ? <Text type="supporting">checking…</Text> : null}
            {health.isError ? <Badge label="unreachable" variant="error" /> : null}
            {health.data ? (
              <VStack gap={0.5}>
                <Badge label={health.data.status} variant="success" />
                <Text type="supporting">uptime {formatUptime(health.data.uptime)}</Text>
              </VStack>
            ) : null}
          </VStack>
        </Card>

        <Card>
          <VStack gap={1}>
            <Text type="label">Session</Text>
            <Text type="supporting">
              Expires {new Date(session.session.expiresAt).toLocaleString()}
            </Text>
          </VStack>
        </Card>

        <Card>
          <VStack gap={1}>
            <Text type="label">Next</Text>
            <Text type="supporting">Connect a Facebook Page and ingest its knowledge.</Text>
          </VStack>
        </Card>
      </Grid>
    </VStack>
  );
}
