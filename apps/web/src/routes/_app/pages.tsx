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
import type { DiscoveredPage } from "@fb-bot/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { resyncPage } from "../../features/knowledge/api.ts";
import {
  connectPage,
  disconnectPage,
  discoverPages,
  loginConfigQueryOptions,
  pagesQueryOptions,
} from "../../features/pages/api.ts";
import { loadFacebookSdk, loginWithFacebook } from "../../features/pages/facebook-sdk.ts";
import { getApiErrorMessage } from "../../lib/api/errors.ts";

export const Route = createFileRoute("/_app/pages")({
  loader: ({ context }) => context.queryClient.ensureQueryData(pagesQueryOptions),
  component: PagesPage,
});

const WEBHOOK_BADGE = {
  active: "success",
  pending: "warning",
  error: "error",
} as const;

function PagesPage() {
  const queryClient = useQueryClient();
  const pages = useQuery(pagesQueryOptions);
  const loginConfig = useQuery(loginConfigQueryOptions);

  const [candidates, setCandidates] = useState<DiscoveredPage[] | null>(null);
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [choosingId, setChoosingId] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isConfigured = (loginConfig.data?.appId.length ?? 0) > 0;

  const invalidatePages = () =>
    queryClient.invalidateQueries({ queryKey: pagesQueryOptions.queryKey });

  const connectMutation = useMutation({
    mutationFn: connectPage,
    onSuccess: invalidatePages,
  });

  const disconnectMutation = useMutation({
    mutationFn: disconnectPage,
    onSuccess: invalidatePages,
  });

  const resyncMutation = useMutation({
    mutationFn: resyncPage,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["knowledge-summary"] });
    },
  });

  const isBusy = connectMutation.isPending || disconnectMutation.isPending || isConnecting;

  async function startConnect() {
    const config = loginConfig.data;

    if (!config) {
      return;
    }

    setError(null);
    setIsConnecting(true);

    try {
      const sdk = await loadFacebookSdk(config.appId, config.graphVersion);
      const accessToken = await loginWithFacebook(sdk, config.scopes);
      const discovered = await discoverPages({ accessToken });

      if (discovered.length === 0) {
        setError("That Facebook account does not manage any Pages.");
        return;
      }

      const [only] = discovered;

      if (discovered.length === 1 && only) {
        await connectMutation.mutateAsync({ accessToken, fbPageId: only.id });
        return;
      }

      setPendingToken(accessToken);
      setCandidates(discovered);
    } catch (thrown: unknown) {
      setError(getApiErrorMessage(thrown));
    } finally {
      setIsConnecting(false);
    }
  }

  async function choosePage(fbPageId: string) {
    if (!pendingToken) {
      return;
    }

    setChoosingId(fbPageId);
    setError(null);

    try {
      await connectMutation.mutateAsync({ accessToken: pendingToken, fbPageId });
      setCandidates(null);
      setPendingToken(null);
    } catch (thrown: unknown) {
      setError(getApiErrorMessage(thrown));
    } finally {
      setChoosingId(null);
    }
  }

  const connectedPages = pages.data ?? [];

  return (
    <VStack gap={6}>
      <VStack gap={1}>
        <Heading level={1}>Pages</Heading>
        <Text type="supporting">
          Connect a Facebook Page so the bot can answer its messages and comments.
        </Text>
      </VStack>

      {error ? <Banner container="card" status="error" title={error} /> : null}

      {connectedPages.some((page) => page.webhookStatus === "error") ? (
        <Banner
          container="card"
          status="error"
          title="Facebook rejected a Page's access token"
          description="Reconnect that Page. Until you do, the bot cannot send anything for it."
        />
      ) : null}

      {loginConfig.isSuccess && !isConfigured ? (
        <Banner
          container="card"
          status="warning"
          title="Facebook is not configured on this server"
          description="Set META_APP_ID, META_APP_SECRET and META_VERIFY_TOKEN, then restart the API."
        />
      ) : null}

      {candidates ? (
        <VStack gap={3}>
          <VStack gap={1}>
            <Heading level={2}>Choose a Page</Heading>
            <Text type="supporting">
              The bot answers for one Page at a time. You can connect more later.
            </Text>
          </VStack>

          <VStack gap={2}>
            {candidates.map((candidate) => (
              <Card key={candidate.id}>
                <HStack align="center" gap={3} justify="between">
                  <VStack gap={0.5}>
                    <Text type="label">{candidate.name}</Text>
                    <Text type="supporting">{candidate.category ?? candidate.id}</Text>
                  </VStack>
                  <Button
                    label="Connect"
                    size="sm"
                    isLoading={choosingId === candidate.id}
                    isDisabled={isBusy}
                    onClick={() => void choosePage(candidate.id)}
                  />
                </HStack>
              </Card>
            ))}
          </VStack>
        </VStack>
      ) : null}

      {connectedPages.length === 0 && !candidates ? (
        <EmptyState
          title="No Page connected yet"
          description="Sign in with Facebook and pick the Page the bot should answer for."
          actions={
            <Button
              label="Connect a Page"
              isLoading={isConnecting}
              isDisabled={!isConfigured || isBusy}
              onClick={() => void startConnect()}
            />
          }
        />
      ) : null}

      {connectedPages.length > 0 ? (
        <VStack gap={4}>
          <Grid columns={{ minWidth: 280, max: 2 }} gap={3}>
            {connectedPages.map((page) => (
              <Card key={page.id}>
                <VStack gap={3}>
                  <VStack gap={0.5}>
                    <Text type="label">{page.name}</Text>
                    <Text type="supporting">Page id {page.fbPageId}</Text>
                  </VStack>

                  <HStack align="center" gap={2}>
                    <Badge
                      label={page.botEnabled ? "Bot on" : "Bot off"}
                      variant={page.botEnabled ? "success" : "neutral"}
                    />
                    <Badge
                      label={`Webhook ${page.webhookStatus}`}
                      variant={WEBHOOK_BADGE[page.webhookStatus]}
                    />
                  </HStack>

                  <HStack align="center" gap={2}>
                    <Button
                      label="Sync now"
                      size="sm"
                      variant="secondary"
                      isLoading={resyncMutation.isPending}
                      isDisabled={isBusy}
                      onClick={() => resyncMutation.mutate(page.id)}
                    />
                    <Button
                      label="Disconnect"
                      size="sm"
                      variant="secondary"
                      isLoading={disconnectMutation.isPending}
                      isDisabled={isBusy}
                      onClick={() => disconnectMutation.mutate(page.id)}
                    />
                  </HStack>
                </VStack>
              </Card>
            ))}
          </Grid>

          {!candidates ? (
            <Button
              label="Connect another Page"
              variant="secondary"
              isLoading={isConnecting}
              isDisabled={!isConfigured || isBusy}
              onClick={() => void startConnect()}
            />
          ) : null}
        </VStack>
      ) : null}
    </VStack>
  );
}
