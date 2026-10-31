import Anthropic from "@anthropic-ai/sdk";

// The key comes only from the server environment; it is never sent to the
// browser (no NEXT_PUBLIC_ prefix) and never logged.
export function createAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("Missing ANTHROPIC_API_KEY");
  }
  return new Anthropic({ apiKey, timeout: 30_000, maxRetries: 2 });
}

export function usageFrom(model: string, usage: Anthropic.Usage | Anthropic.Beta.BetaUsage) {
  return {
    model,
    input_tokens: usage.input_tokens,
    output_tokens: usage.output_tokens,
    cache_read_tokens: usage.cache_read_input_tokens ?? 0,
    cache_write_tokens: usage.cache_creation_input_tokens ?? 0,
  };
}

// Logs only the error class and status, never request or response content.
export function describeApiError(error: unknown): string {
  if (error instanceof Anthropic.APIError) {
    return `${error.constructor.name} status=${error.status ?? "none"}`;
  }
  return error instanceof Error ? error.name : "unknown error";
}
