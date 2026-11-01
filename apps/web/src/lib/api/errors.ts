import axios from "axios";

type ApiErrorBody = {
  message?: unknown;
  error?: { message?: unknown };
};

export function getApiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as ApiErrorBody | undefined;
    const message = data?.message ?? data?.error?.message;

    if (typeof message === "string" && message.length > 0) {
      return message;
    }

    if (error.response) {
      return `Request failed with status ${error.response.status}`;
    }
  }

  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
}
