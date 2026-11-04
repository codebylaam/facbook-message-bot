import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Layout, LayoutContent, LayoutHeader } from "@astryxdesign/core/Layout";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import type { ReactNode } from "react";

type PageProps = {
  title: string;
  description?: string;
  /** Primary action for the page, pinned in the header. */
  actions?: ReactNode;
  /** Content line: 640 for forms and text, 960 for content pages, wider for two panes. */
  contentWidth?: number;
  children: ReactNode;
};

/**
 * The frame every signed-in page uses: a pinned header carrying the title, the
 * description and the page's primary action, over a content region that scrolls
 * on its own. Pages pass their sections as children and never build the header
 * themselves, so the title level, the description style and the gaps are the
 * same everywhere.
 */
export function Page({ title, description, actions, contentWidth = 960, children }: PageProps) {
  return (
    <Layout
      padding={4}
      contentWidth={contentWidth}
      defaultHasDividers
      header={
        <LayoutHeader>
          <HStack align="start" gap={4} justify="between">
            <VStack gap={1}>
              <Heading level={1}>{title}</Heading>
              {description ? <Text type="supporting">{description}</Text> : null}
            </VStack>
            {actions}
          </HStack>
        </LayoutHeader>
      }
    >
      <LayoutContent>
        <VStack gap={6}>{children}</VStack>
      </LayoutContent>
    </Layout>
  );
}
