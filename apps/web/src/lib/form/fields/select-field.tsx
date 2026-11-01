import { Selector } from "@astryxdesign/core/Selector";
import { useFieldContext } from "../context.ts";
import { firstErrorMessage } from "../error-message.ts";

export type SelectFieldOption = {
  value: string;
  label: string;
};

export type SelectFieldProps = {
  label: string;
  options: SelectFieldOption[];
  placeholder?: string;
  description?: string;
  size?: "sm" | "md" | "lg";
};

export function SelectField({ label, options, ...rest }: SelectFieldProps) {
  const field = useFieldContext<string>();
  const errorMessage = firstErrorMessage(field.state.meta.errors);

  return (
    <Selector
      {...rest}
      label={label}
      options={options}
      value={field.state.value}
      onChange={(value) => field.handleChange(value)}
      status={errorMessage ? { type: "error", message: errorMessage } : undefined}
    />
  );
}
