export function firstErrorMessage(errors: readonly unknown[]): string | undefined {
  const [first] = errors;

  if (first === undefined) {
    return undefined;
  }

  if (typeof first === "string") {
    return first;
  }

  if (typeof first === "object" && first !== null && "message" in first) {
    const { message } = first as { message?: unknown };
    return typeof message === "string" ? message : undefined;
  }

  return String(first);
}
