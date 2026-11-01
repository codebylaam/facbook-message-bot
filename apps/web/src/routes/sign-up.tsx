import { Banner } from "@astryxdesign/core/Banner";
import { Link } from "@astryxdesign/core/Link";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { signUpSchema } from "@fb-bot/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { loadSession, sessionQueryOptions, signUp } from "../features/auth/api.ts";
import { AuthShell } from "../features/auth/auth-page.tsx";
import { getApiErrorMessage } from "../lib/api/errors.ts";
import { useAppForm } from "../lib/form/index.ts";

export const Route = createFileRoute("/sign-up")({
  beforeLoad: async ({ context }) => {
    const session = await loadSession(context.queryClient);

    if (session) {
      throw redirect({ to: "/" });
    }
  },
  component: SignUpPage,
});

function SignUpPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: signUp,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: sessionQueryOptions.queryKey });
      await navigate({ to: "/" });
    },
  });

  const form = useAppForm({
    defaultValues: { name: "", email: "", password: "" },
    validators: { onChange: signUpSchema, onSubmit: signUpSchema },
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
    <AuthShell title="Create your account" description="Start replying to customers automatically.">
      {formError ? <Banner status="error" title={formError} container="card" /> : null}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
      >
        <VStack gap={4}>
          <form.AppField name="name">
            {(field) => <field.TextField label="Name" autoComplete="name" size="lg" />}
          </form.AppField>

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
                description="At least 8 characters"
                autoComplete="new-password"
                size="lg"
              />
            )}
          </form.AppField>

          <form.AppForm>
            <form.SubmitButton label="Create account" />
          </form.AppForm>
        </VStack>
      </form>

      <VStack gap={1} hAlign="center">
        <Text type="supporting">Already have an account?</Text>
        <Link href="/sign-in">Sign in</Link>
      </VStack>
    </AuthShell>
  );
}
