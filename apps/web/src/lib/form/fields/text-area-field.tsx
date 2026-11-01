import { TextArea } from "@astryxdesign/core/TextArea";
import { useFieldContext } from "../context.ts";
import { firstErrorMessage } from "../error-message.ts";

export type TextAreaFieldProps = {
  label: string;
  placeholder?: string;
  description?: string;
  rows?: number;
};

export function TextAreaField({ label, ...rest }: TextAreaFieldProps) {
  const field = useFieldContext<string>();
  const errorMessage = firstErrorMessage(field.state.meta.errors);

  return (
    <TextArea
      {...rest}
      label={label}
      value={field.state.value}
      onChange={(value) => field.handleChange(value)}
      onBlur={() => field.handleBlur()}
      status={errorMessage ? { type: "error", message: errorMessage } : undefined}
    />
  );
}
