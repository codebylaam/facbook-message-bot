import { Badge } from "@astryxdesign/core/Badge";
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { Grid } from "@astryxdesign/core/Grid";
import { Heading } from "@astryxdesign/core/Heading";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { billingQueryOptions, deleteAccount } from "../../features/billing/api.ts";

export const Route = createFileRoute("/_app/billing")({
  loader: ({ context }) => context.queryClient.ensureQueryData(billingQueryOptions),
  component: BillingPage,
});

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleDateString() : "not set";
}

function BillingPage() {
  const billing = useQuery(billingQueryOptions);
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const data = billing.data;

  const remove = useMutation({
    mutationFn: deleteAccount,
    onSuccess: async () => {
      await navigate({ to: "/sign-in" });
    },
  });

  if (!data) {
    return <Text type="supporting">Loading…</Text>;
  }

  return (
    <VStack gap={6}>
      <VStack gap={1}>
        <Heading level={1}>Billing</Heading>
        <Text type="supporting">Your plan and how much of it this month has used.</Text>
      </VStack>

      {data.paused ? (
        <Banner
          container="card"
          status="error"
          title="The bot is paused: this month's AI replies are used up"
          description={`You have used ${data.used} of ${data.aiRepliesPerMonth}. Ask for a bigger plan to turn replies back on.`}
        />
      ) : null}

      {!data.hasPlan ? (
        <Banner
          container="card"
          status="info"
          title="No plan assigned yet"
          description={`Until a plan is assigned you are on the default allowance of ${data.aiRepliesPerMonth} AI replies a month.`}
        />
      ) : null}

      <Grid columns={{ minWidth: 240, max: 3 }} gap={3}>
        <Card>
          <VStack gap={1}>
            <Text type="label">Plan</Text>
            <Text>{data.planName ?? "No plan"}</Text>
            <Badge
              label={data.status ?? "default"}
              variant={data.status === "active" ? "success" : "neutral"}
            />
          </VStack>
        </Card>

        <Card>
          <VStack gap={1}>
            <Text type="label">AI replies this month</Text>
            <Text hasTabularNumbers>
              {data.used} of {data.aiRepliesPerMonth}
            </Text>
            <Text type="supporting">{data.remaining} left</Text>
          </VStack>
        </Card>

        <Card>
          <VStack gap={1}>
            <Text type="label">Pages</Text>
            <Text hasTabularNumbers>
              {data.pagesUsed} of {data.pageLimit}
            </Text>
            <Text type="supporting">{data.price ? `${data.price} BDT a month` : "free"}</Text>
          </VStack>
        </Card>
      </Grid>

      <VStack gap={1}>
        <Text type="label">Current period</Text>
        <Text type="supporting">
          {formatDate(data.periodStart)} to {formatDate(data.periodEnd)}
        </Text>
      </VStack>

      <Card>
        <VStack gap={2}>
          <Text type="label">Delete my account</Text>
          <Text type="supporting">
            Removes this account, its Pages, knowledge, conversations, comments and leads. This
            cannot be undone.
          </Text>
          <Button
            label={confirming ? "Yes, delete everything" : "Delete my account"}
            size="sm"
            variant="secondary"
            isLoading={remove.isPending}
            onClick={() => {
              if (!confirming) {
                setConfirming(true);
                return;
              }

              remove.mutate();
            }}
          />
        </VStack>
      </Card>
    </VStack>
  );
}
