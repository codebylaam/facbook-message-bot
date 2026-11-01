import { NumberInput } from "@astryxdesign/core/NumberInput";
import { useFieldContext } from "../context.ts";
import { firstErrorMessage } from "../error-message.ts";

export type NumberFieldProps = {
  label: string;
  placeholder?: string;
  description?: string;
  min?: number | null;
  max?: number | null;
  step?: number | null;
};

export function NumberField({ label, ...rest }: NumberFieldProps) {
  const field = useFieldContext<number | null>();
  const errorMessage = firstErrorMessage(field.state.meta.errors);

  return (
    <NumberInput
      {...rest}
      label={label}
      value={field.state.value}
      onChange={(value) => field.handleChange(value)}
      onBlur={() => field.handleBlur()}
      status={errorMessage ? { type: "error", message: errorMessage } : undefined}
    />
  );
}
