export type ChatRole = "system" | "user" | "assistant";

export type ChatMessage = {
  role: ChatRole;
  content: string;
};

export type ChatUsage = {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
};

export type ChatResult = {
  content: string;
  model: string;
  usage: ChatUsage;
};

export type ChatOptions = {
  temperature?: number;
  maxTokens?: number;
  json?: boolean;
};

export type LlmClient = {
  chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResult>;
};

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export class LlmError extends Error {
  readonly status: number | undefined;
  readonly retryAfterMs: number | undefined;

  constructor(message: string, status?: number, retryAfterMs?: number) {
    super(message);
    this.name = "LlmError";
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}
