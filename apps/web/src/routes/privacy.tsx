import { Card } from "@astryxdesign/core/Card";
import { Center } from "@astryxdesign/core/Center";
import { Heading } from "@astryxdesign/core/Heading";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
});

const SECTIONS = [
  {
    title: "What we collect",
    body: "A seller account stores a name, an email address and a hashed password. A connected Facebook Page stores its id, its name, an encrypted access token, its public profile, its posts, and the products and answers you add.",
  },
  {
    title: "Customer messages",
    body: "Messages and comments customers send to a connected Page are stored so the bot can answer them and so you can read the conversation later. We store the Page-scoped customer id, the message text and any attachments.",
  },
  {
    title: "What we send to model providers",
    body: "The message being answered, a short conversation summary, recent messages and the knowledge retrieved for that question are sent to the language model provider. Embeddings are computed by Cloudflare Workers AI. Neither is used to train a model.",
  },
  {
    title: "How long we keep it",
    body: "Data stays while the account exists. Deleting the account deletes the Pages, knowledge, conversations, comments, leads and usage that belong to it.",
  },
  {
    title: "Deleting your data",
    body: "Open Billing and use Delete my account, or use the deletion link Facebook gives you. Either way the seller account and everything attached to it is removed.",
  },
];

function PrivacyPage() {
  return (
    <Center axis="both" minHeight="100dvh" padding={6}>
      <VStack gap={4} maxWidth={720} width="100%">
        <Heading level={1}>Privacy policy</Heading>
        <Text type="supporting">
          How this reply bot handles your data and your customers' data.
        </Text>

        {SECTIONS.map((section) => (
          <Card key={section.title}>
            <VStack gap={1}>
              <Heading level={2}>{section.title}</Heading>
              <Text>{section.body}</Text>
            </VStack>
          </Card>
        ))}
      </VStack>
    </Center>
  );
}
