import { Card } from "@astryxdesign/core/Card";
import { Center } from "@astryxdesign/core/Center";
import { Heading } from "@astryxdesign/core/Heading";
import { Icon } from "@astryxdesign/core/Icon";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { CubeIcon } from "@heroicons/react/24/outline";
import type { ReactNode } from "react";

type AuthShellProps = {
  title: string;
  description: string;
  children: ReactNode;
};

export function AuthShell({ title, description, children }: AuthShellProps) {
  return (
    <Center axis="both" minHeight="100dvh" padding={6}>
      <VStack gap={4} hAlign="center" maxWidth={400} width="100%">
        <VStack gap={2} hAlign="center">
          <Icon icon={CubeIcon} size="lg" />
          <Text type="body" weight="bold" size="lg">
            FB Bot
          </Text>
        </VStack>

        <Card padding={8} width="100%">
          <VStack gap={4} hAlign="stretch">
            <VStack gap={1} hAlign="center">
              <Heading level={2}>{title}</Heading>
              <Text type="body" color="secondary" size="sm">
                {description}
              </Text>
            </VStack>

            {children}
          </VStack>
        </Card>
      </VStack>
    </Center>
  );
}
