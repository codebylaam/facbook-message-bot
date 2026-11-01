import { createFormHook } from "@tanstack/react-form";
import { fieldContext, formContext } from "./context.ts";
import { SubmitButton } from "./fields/submit-button.tsx";
import { TextField } from "./fields/text-field.tsx";

export const { useAppForm, withForm } = createFormHook({
  fieldComponents: { TextField },
  formComponents: { SubmitButton },
  fieldContext,
  formContext,
});
