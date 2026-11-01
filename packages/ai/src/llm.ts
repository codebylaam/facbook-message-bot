import type { LlmConfig } from "./config.ts";
import {
  type ChatMessage,
  type ChatOptions,
  type ChatResult,
  type FetchLike,
  type LlmClient,
  LlmError,
} from "./llm-types.ts";

const RETRYABLE_STATUS = new Set([408, 409, 425, 429, 500, 502, 503, 504]);
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY_MS = 500;
const DEFAULT_TIMEOUT_MS = 60_000;

type CompletionResponse = {
  model?: string;
  choices?: Array<{ message?: { content?: string | null } }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
};

function retryAfterMs(response: Response): number | undefined {
  const header = response.headers.get("retry-after");

  if (!header) {
    return undefined;
  }

  const seconds = Number(header);
  return Number.isFinite(seconds) ? Math.max(0, seconds * 1000) : undefined;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createLlmClient(config: LlmConfig, fetchImpl: FetchLike = fetch): LlmClient {
  const maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;
  const baseDelay = config.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const url = `${config.baseUrl.replace(/\/$/, "")}/chat/completions`;

  async function attempt(messages: ChatMessage[], options: ChatOptions): Promise<ChatResult> {
    const response = await fetchImpl(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      signal: AbortSignal.timeout(timeoutMs),
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature: options.temperature ?? 0.2,
        ...(options.maxTokens === undefined ? {} : { max_tokens: options.maxTokens }),
        ...(options.json ? { response_format: { type: "json_object" } } : {}),
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new LlmError(
        `LLM request failed with ${response.status}: ${body.slice(0, 300)}`,
        response.status,
        retryAfterMs(response),
      );
    }

    const parsed = (await response.json()) as CompletionResponse;
    const content = parsed.choices?.[0]?.message?.content ?? "";

    if (content.trim().length === 0) {
      throw new LlmError("LLM returned an empty completion");
    }

    return {
      content,
      model: parsed.model ?? config.model,
      usage: {
        promptTokens: parsed.usage?.prompt_tokens,
        completionTokens: parsed.usage?.completion_tokens,
        totalTokens: parsed.usage?.total_tokens,
      },
    };
  }

  return {
    async chat(messages, options = {}) {
      let lastError: unknown;

      for (let attemptIndex = 0; attemptIndex <= maxRetries; attemptIndex += 1) {
        try {
          return await attempt(messages, options);
        } catch (error) {
          lastError = error;

          const status = error instanceof LlmError ? error.status : undefined;
          const isRetryable = status === undefined || RETRYABLE_STATUS.has(status);

          if (!isRetryable || attemptIndex === maxRetries) {
            throw error;
          }

          const retryAfter = error instanceof LlmError ? error.retryAfterMs : undefined;
          await wait(retryAfter ?? baseDelay * 2 ** attemptIndex);
        }
      }

      throw lastError;
    },
  };
}
