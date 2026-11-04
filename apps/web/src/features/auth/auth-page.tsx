import { Card } from "@astryxdesign/core/Card";
import { Center } from "@astryxdesign/core/Center";
import { Heading } from "@astryxdesign/core/Heading";
import { Icon } from "@astryxdesign/core/Icon";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { SparklesIcon } from "@heroicons/react/24/outline";
import type { ReactNode } from "react";

type AuthShellProps = {
  title: string;
  description: string;
  children: ReactNode;
};

/**
 * The frame for the signed-out pages. It carries the same brand mark as the rail
 * in AppShell, and the title is the page's only heading, so it is an h1.
 */
export function AuthShell({ title, description, children }: AuthShellProps) {
  return (
    <Center axis="both" minHeight="100dvh" padding={6}>
      <VStack gap={4} hAlign="center" maxWidth={400} width="100%">
        <VStack gap={2} hAlign="center">
          <Icon icon={SparklesIcon} size="lg" />
          <Text type="body" weight="bold" size="lg">
            FB Bot
          </Text>
        </VStack>

        <Card padding={8} width="100%">
          <VStack gap={4} hAlign="stretch">
            <VStack gap={1} hAlign="center">
              <Heading level={1}>{title}</Heading>
              <Text type="supporting">{description}</Text>
            </VStack>

            {children}
          </VStack>
        </Card>
      </VStack>
    </Center>
  );
}
