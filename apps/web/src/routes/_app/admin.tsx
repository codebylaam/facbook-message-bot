import { Badge } from "@astryxdesign/core/Badge";
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { HStack } from "@astryxdesign/core/HStack";
import { Selector } from "@astryxdesign/core/Selector";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import type { AdminUser, Plan } from "@fb-bot/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import {
  adminPlansQueryOptions,
  adminUsersQueryOptions,
  assignPlan,
  setUserRole,
} from "../../features/billing/api.ts";
import { getApiErrorMessage } from "../../lib/api/errors.ts";
import { Page } from "../../lib/page.tsx";

export const Route = createFileRoute("/_app/admin")({
  beforeLoad: ({ context }) => {
    // The API answers 403 to anyone else, so send them back before the loader runs.
    if (context.session.user.role !== "admin") {
      throw redirect({ to: "/" });
    }
  },
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(adminUsersQueryOptions),
      context.queryClient.ensureQueryData(adminPlansQueryOptions),
    ]),
  component: AdminPage,
});

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleDateString() : "none";
}

function UserRow({
  user,
  plans,
  onError,
}: {
  user: AdminUser;
  plans: Plan[];
  onError: (message: string) => void;
}) {
  const queryClient = useQueryClient();
  const [planName, setPlanName] = useState(user.planName ?? plans[0]?.name ?? "");

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["admin"] });
    await queryClient.invalidateQueries({ queryKey: ["billing"] });
  };

  const assign = useMutation({
    mutationFn: () => assignPlan(user.id, planName, 1),
    onSuccess: async () => {
      onError("");
      await refresh();
    },
    onError: (thrown: unknown) => onError(getApiErrorMessage(thrown)),
  });

  const promote = useMutation({
    mutationFn: () => setUserRole(user.id, user.role === "admin" ? "seller" : "admin"),
    onSuccess: refresh,
    onError: (thrown: unknown) => onError(getApiErrorMessage(thrown)),
  });

  return (
    <Card>
      <VStack gap={3}>
        <HStack align="center" gap={2} justify="between">
          <VStack gap={0.5}>
            <Text type="label">{user.name}</Text>
            <Text type="supporting">{user.email}</Text>
          </VStack>
          <HStack align="center" gap={2}>
            <Badge label={user.role} variant={user.role === "admin" ? "purple" : "neutral"} />
            <Badge
              label={user.planName ?? "no plan"}
              variant={user.planName ? "info" : "neutral"}
            />
          </HStack>
        </HStack>

        <HStack align="center" gap={3} justify="between">
          <Text type="supporting">
            {user.used} used
            {user.aiRepliesPerMonth ? ` of ${user.aiRepliesPerMonth}` : ""} · period ends{" "}
            {formatDate(user.periodEnd)}
          </Text>

          <HStack align="center" gap={2}>
            <VStack width={220}>
              <Selector
                label="Plan"
                options={plans.map((plan) => ({
                  value: plan.name,
                  label: `${plan.name} — ${plan.aiRepliesPerMonth} replies`,
                }))}
                value={planName}
                onChange={setPlanName}
              />
            </VStack>
            <Button
              label="Assign one month"
              size="sm"
              isLoading={assign.isPending}
              isDisabled={planName.length === 0}
              onClick={() => assign.mutate()}
            />
            <Button
              label={user.role === "admin" ? "Make seller" : "Make admin"}
              size="sm"
              variant="secondary"
              isLoading={promote.isPending}
              onClick={() => promote.mutate()}
            />
          </HStack>
        </HStack>
      </VStack>
    </Card>
  );
}

function AdminPage() {
  const users = useQuery(adminUsersQueryOptions);
  const plans = useQuery(adminPlansQueryOptions);
  const [error, setError] = useState<string | null>(null);

  const rows = users.data ?? [];
  const planList = plans.data ?? [];

  return (
    <Page
      title="Admin"
      description="Assign a plan by hand. There is no payment gateway yet, so this is the only way a seller gets more replies."
    >
      {error ? <Banner container="card" status="error" title={error} /> : null}

      {rows.length === 0 ? (
        <EmptyState title="No users yet" description="Sellers appear here once they sign up." />
      ) : (
        <VStack gap={2}>
          {rows.map((user) => (
            <UserRow
              key={user.id}
              user={user}
              plans={planList}
              onError={(message) => setError(message.length > 0 ? message : null)}
            />
          ))}
        </VStack>
      )}
    </Page>
  );
}
