import { Badge } from "@astryxdesign/core/Badge";
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { HStack } from "@astryxdesign/core/HStack";
import { Section } from "@astryxdesign/core/Section";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import type { PlaygroundResponse } from "@fb-bot/shared";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import {
  playgroundConfigQueryOptions,
  sendPlaygroundMessage,
} from "../../features/playground/api.ts";
import { getApiErrorMessage } from "../../lib/api/errors.ts";
import { useAppForm } from "../../lib/form/index.ts";
import { Page } from "../../lib/page.tsx";

export const Route = createFileRoute("/_app/playground")({
  component: PlaygroundPage,
});

const SAMPLE_QUESTIONS = [
  { label: "Banglish", text: "ei shirt er dam koto, L size ache?" },
  { label: "বাংলা", text: "ঢাকার বাইরে ডেলিভারি চার্জ কত?" },
  { label: "English", text: "Do you ship to Canada?" },
];

const messageSchema = z.object({
  message: z.string().min(1, "Type a message to test").max(2000),
});

const LANGUAGE_LABEL: Record<string, string> = {
  bn: "Bangla",
  banglish: "Banglish",
  en: "English",
};

function ResultCard({ result }: { result: PlaygroundResponse }) {
  const sent = result.decision.action === "send";

  return (
    <VStack gap={4}>
      <HStack align="center" gap={2}>
        <Badge
          label={sent ? "Bot would send" : "Handed to a human"}
          variant={sent ? "success" : "warning"}
        />
        {result.output ? (
          <Badge
            label={`confidence ${result.output.confidence.toFixed(2)}`}
            variant={result.output.confidence >= 0.7 ? "success" : "warning"}
          />
        ) : null}
        <Badge
          label={LANGUAGE_LABEL[result.rewrite.language] ?? result.rewrite.language}
          variant="neutral"
        />
        <Badge label={result.rewrite.intent} variant="neutral" />
      </HStack>

      {sent ? (
        <Card>
          <VStack gap={1}>
            <Text type="label">Reply</Text>
            <Text>{result.decision.reply ?? ""}</Text>
          </VStack>
        </Card>
      ) : (
        <VStack gap={2}>
          <Banner
            container="card"
            status="warning"
            title={result.decision.reason ?? "Handed to a human"}
            description="The customer would see nothing automatic; you would answer from the inbox."
          />
          {result.decision.draft ? (
            <Card>
              <VStack gap={1}>
                <Text type="label">Draft the model suggested</Text>
                <Text type="supporting">{result.decision.draft}</Text>
              </VStack>
            </Card>
          ) : null}
        </VStack>
      )}

      {result.generationError ? (
        <Banner
          container="card"
          status="error"
          title="The model call failed"
          description={result.generationError}
        />
      ) : null}

      <VStack gap={1}>
        <Text type="label">Search query the rewrite produced</Text>
        <Text type="supporting">{result.rewrite.query}</Text>
      </VStack>

      <VStack gap={2}>
        <HStack align="center" gap={2}>
          <Text type="label">Sources it looked at</Text>
          {result.embeddingsUsed ? null : (
            <Badge label="text only, embeddings unavailable" variant="warning" />
          )}
        </HStack>

        {result.retrieved.length === 0 ? (
          <Text type="supporting">
            Nothing matched, which is why this may have been handed off.
          </Text>
        ) : (
          result.retrieved.map((source) => (
            <Card key={source.id}>
              <VStack gap={0.5}>
                <HStack align="center" gap={2}>
                  <Badge label={source.sourceType} variant="info" />
                  <Text type="supporting" hasTabularNumbers>
                    score {source.score.toFixed(4)}
                  </Text>
                </HStack>
                <Text type="supporting" maxLines={3}>
                  {source.content}
                </Text>
              </VStack>
            </Card>
          ))
        )}
      </VStack>
    </VStack>
  );
}

function PlaygroundPage() {
  const config = useQuery(playgroundConfigQueryOptions);

  const [result, setResult] = useState<PlaygroundResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({ mutationFn: sendPlaygroundMessage });

  const form = useAppForm({
    defaultValues: { message: "" },
    validators: { onChange: messageSchema, onSubmit: messageSchema },
    onSubmit: async ({ value }) => {
      setError(null);
      setResult(null);

      try {
        setResult(await mutation.mutateAsync({ message: value.message }));
      } catch (thrown: unknown) {
        setError(getApiErrorMessage(thrown));
      }
    },
  });

  const configured = config.data?.configured ?? false;

  return (
    <Page
      title="Playground"
      description="Ask what a customer would ask. This runs the real reply pipeline against your knowledge, without touching Facebook."
    >
      {config.isSuccess && !configured ? (
        <Banner
          container="card"
          status="warning"
          title="The reply model is not configured"
          description="Set CMD_API_KEY for the API, then restart it."
        />
      ) : null}

      {error ? <Banner container="card" status="error" title={error} /> : null}

      <Section>
        <VStack gap={4}>
          <HStack align="center" gap={2}>
            <Text type="supporting">Try one:</Text>
            {SAMPLE_QUESTIONS.map((sample) => (
              <Button
                key={sample.label}
                label={sample.label}
                size="sm"
                variant="secondary"
                onClick={() => form.setFieldValue("message", sample.text)}
              />
            ))}
          </HStack>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              void form.handleSubmit();
            }}
          >
            <VStack gap={4}>
              <form.AppField name="message">
                {(field) => (
                  <field.TextAreaField
                    label="Customer message"
                    rows={3}
                    placeholder="ei shirt er dam koto?"
                  />
                )}
              </form.AppField>

              <form.AppForm>
                <form.SubmitButton label="Send to the bot" size="md" />
              </form.AppForm>
            </VStack>
          </form>
        </VStack>
      </Section>

      {result ? <ResultCard result={result} /> : null}
    </Page>
  );
}
