import { Button } from "@astryxdesign/core/Button";
import { useStore } from "@tanstack/react-form";
import { useFormContext } from "../context.ts";

export type SubmitButtonProps = {
  label: string;
  size?: "sm" | "md" | "lg";
};

export function SubmitButton({ label, size = "lg" }: SubmitButtonProps) {
  const form = useFormContext();
  const isSubmitting = useStore(form.store, (state) => state.isSubmitting);

  return (
    <Button
      type="submit"
      label={label}
      variant="primary"
      size={size}
      isLoading={isSubmitting}
      isDisabled={isSubmitting}
    />
  );
}
