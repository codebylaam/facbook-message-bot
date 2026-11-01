import { Button } from "@astryxdesign/core/Button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { sessionQueryOptions, signOut } from "./api.ts";

export function SignOutButton() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const mutation = useMutation({
    mutationFn: signOut,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: sessionQueryOptions.queryKey });
      await navigate({ to: "/sign-in" });
    },
  });

  return (
    <Button
      label="Sign out"
      variant="secondary"
      size="sm"
      isLoading={mutation.isPending}
      isDisabled={mutation.isPending}
      onClick={() => mutation.mutate()}
    />
  );
}
