import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { Center } from "@astryxdesign/core/Center";
import { Heading } from "@astryxdesign/core/Heading";
import { Link } from "@astryxdesign/core/Link";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

export const Route = createFileRoute("/data-deletion")({
  validateSearch: z.object({ code: z.string().optional() }),
  component: DataDeletionPage,
});

function DataDeletionPage() {
  const { code } = Route.useSearch();

  return (
    <Center axis="both" minHeight="100dvh" padding={6}>
      <VStack gap={4} maxWidth={560} width="100%">
        <Heading level={1}>Delete your data</Heading>

        <Card>
          <VStack gap={3}>
            <Text>
              Facebook asked us to delete the data we hold for you. Because we never store your
              Facebook identity, we cannot match the request to an account on our own, so the
              deletion is completed from your account.
            </Text>

            {code ? (
              <VStack gap={1}>
                <Text type="label">Your confirmation code</Text>
                <Text type="code">{code}</Text>
              </VStack>
            ) : null}

            <Text type="supporting">
              Sign in, open Billing, and choose Delete my account. That removes the account, the
              connected Pages, the knowledge, and every conversation, comment and lead.
            </Text>

            <Link href="/sign-in">Sign in to continue</Link>
          </VStack>
        </Card>

        <Button
          label="Read the privacy policy"
          variant="secondary"
          onClick={() => {
            window.location.assign("/privacy");
          }}
        />
      </VStack>
    </Center>
  );
}
