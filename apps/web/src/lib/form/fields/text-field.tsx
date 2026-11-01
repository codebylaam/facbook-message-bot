import { TextInput } from "@astryxdesign/core/TextInput";
import { useFieldContext } from "../context.ts";
import { firstErrorMessage } from "../error-message.ts";

export type TextFieldProps = {
  label: string;
  type?: "text" | "email" | "password";
  placeholder?: string;
  autoComplete?: string;
  description?: string;
  size?: "sm" | "md" | "lg";
};

export function TextField({ label, type = "text", ...inputProps }: TextFieldProps) {
  const field = useFieldContext<string>();
  const errorMessage = firstErrorMessage(field.state.meta.errors);

  return (
    <TextInput
      {...inputProps}
      label={label}
      type={type}
      value={field.state.value}
      onChange={(value) => field.handleChange(value)}
      onBlur={() => field.handleBlur()}
      status={errorMessage ? { type: "error", message: errorMessage } : undefined}
    />
  );
}
