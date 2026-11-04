import { FileInput } from "@astryxdesign/core/FileInput";
import { useFieldContext } from "../context.ts";
import { firstErrorMessage } from "../error-message.ts";

export type FileFieldProps = {
  label: string;
  accept?: string;
  maxSize?: number;
  description?: string;
  placeholder?: string;
  mode?: "input" | "dropzone";
  isDisabled?: boolean;
};

/**
 * Single-file field. FileInput hands back a File or a File[], so a multi-select
 * never reaches the value: a document is uploaded and indexed one at a time.
 */
export function FileField({ label, mode = "dropzone", ...inputProps }: FileFieldProps) {
  const field = useFieldContext<File | null>();
  const errorMessage = firstErrorMessage(field.state.meta.errors);

  return (
    <FileInput
      {...inputProps}
      label={label}
      mode={mode}
      value={field.state.value}
      onChange={(files) => {
        const picked = Array.isArray(files) ? files[0] : files;
        field.handleChange(picked ?? null);
      }}
      status={errorMessage ? { type: "error", message: errorMessage } : undefined}
    />
  );
}
