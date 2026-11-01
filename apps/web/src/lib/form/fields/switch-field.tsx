import { Switch } from "@astryxdesign/core/Switch";
import { useFieldContext } from "../context.ts";

export type SwitchFieldProps = {
  label: string;
  description?: string;
};

export function SwitchField({ label, description }: SwitchFieldProps) {
  const field = useFieldContext<boolean>();

  return (
    <Switch
      label={label}
      description={description}
      value={field.state.value}
      onChange={(checked) => field.handleChange(checked)}
      onBlur={() => field.handleBlur()}
    />
  );
}
