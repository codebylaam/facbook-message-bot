import { createFormHook } from "@tanstack/react-form";
import { fieldContext, formContext } from "./context.ts";
import { FileField } from "./fields/file-field.tsx";
import { NumberField } from "./fields/number-field.tsx";
import { SelectField } from "./fields/select-field.tsx";
import { SubmitButton } from "./fields/submit-button.tsx";
import { SwitchField } from "./fields/switch-field.tsx";
import { TextAreaField } from "./fields/text-area-field.tsx";
import { TextField } from "./fields/text-field.tsx";

export const { useAppForm, withForm } = createFormHook({
  fieldComponents: {
    TextField,
    TextAreaField,
    NumberField,
    SelectField,
    SwitchField,
    FileField,
  },
  formComponents: { SubmitButton },
  fieldContext,
  formContext,
});
