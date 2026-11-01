import { Banner } from "@astryxdesign/core/Banner";
import { Link } from "@astryxdesign/core/Link";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { signInSchema } from "@fb-bot/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { loadSession, sessionQueryOptions, signIn } from "../features/auth/api.ts";
import { AuthShell } from "../features/auth/auth-page.tsx";
import { getApiErrorMessage } from "../lib/api/errors.ts";
import { useAppForm } from "../lib/form/index.ts";

export const Route = createFileRoute("/sign-in")({
  beforeLoad: async ({ context }) => {
    const session = await loadSession(context.queryClient);

    if (session) {
      throw redirect({ to: "/" });
    }
  },
  component: SignInPage,
});

function SignInPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: signIn,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: sessionQueryOptions.queryKey });
      await navigate({ to: "/" });
    },
  });

  const form = useAppForm({
    defaultValues: { email: "", password: "" },
    validators: { onChange: signInSchema, onSubmit: signInSchema },
    onSubmit: async ({ value }) => {
      setFormError(null);
      try {
        await mutation.mutateAsync(value);
      } catch (error) {
        setFormError(getApiErrorMessage(error));
      }
    },
  });

  return (
    <AuthShell title="Sign in" description="Welcome back to your reply bot.">
      {formError ? <Banner status="error" title={formError} container="card" /> : null}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
      >
        <VStack gap={4}>
          <form.AppField name="email">
            {(field) => (
              <field.TextField
                label="Email"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                size="lg"
              />
            )}
          </form.AppField>

          <form.AppField name="password">
            {(field) => (
              <field.TextField
                label="Password"
                type="password"
                autoComplete="current-password"
                size="lg"
              />
            )}
          </form.AppField>

          <form.AppForm>
            <form.SubmitButton label="Sign in" />
          </form.AppForm>
        </VStack>
      </form>

      <VStack gap={1} hAlign="center">
        <Text type="supporting">New here?</Text>
        <Link href="/sign-up">Create an account</Link>
      </VStack>
    </AuthShell>
  );
}
