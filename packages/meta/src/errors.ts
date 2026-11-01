export type GraphErrorBody = {
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
};

export class GraphApiError extends Error {
  readonly status: number;
  readonly code?: number;
  readonly subcode?: number;
  readonly body: unknown;

  constructor(
    message: string,
    options: { status: number; code?: number; subcode?: number; body: unknown },
  ) {
    super(message);
    this.name = "GraphApiError";
    this.status = options.status;
    this.code = options.code;
    this.subcode = options.subcode;
    this.body = options.body;
  }
}

export function describeGraphError(error: unknown): string {
  if (error instanceof GraphApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "The Facebook Graph API request failed";
}

export function isTokenInvalidError(error: unknown): boolean {
  if (!(error instanceof GraphApiError)) {
    return false;
  }

  return (
    error.status === 401 ||
    error.code === 190 ||
    error.subcode === 463 ||
    error.subcode === 467 ||
    error.code === 102
  );
}
