// AI models, prices and limits (SPEC section 2). Plain module without
// imports so standalone scripts can use it too.

// The mentor moved from Haiku 4.5 to Sonnet 5.5 after the scenario runs: it
// follows the teaching rules (one question, check the arithmetic, no hints)
// far more reliably. Decided with the project owner.
export const AI_MODELS = {
  mentor: "claude-sonnet-5-5",
  grader: "claude-sonnet-5-5",
} as const;

// USD per million tokens. Cache writes use the 5-minute TTL price (1.25x input).
// Re-check before launch: https://platform.claude.com/docs/en/about-claude/pricing
export type ModelPrice = { input: number; output: number; cacheRead: number; cacheWrite: number };

export const MODEL_PRICES: Record<string, ModelPrice> = {
  "claude-haiku-4-5": { input: 1, output: 5, cacheRead: 0.1, cacheWrite: 1.25 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  // Server-side fallback target for Sonnet 5.5 refusals.
  "claude-sonnet-5": { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
};

export const AI_LIMITS = {
  messageMaxChars: 1000,
  // Answer check: JSON verdict, no thinking.
  maxTokens: 400,
  // Mentor: includes its hidden reasoning (adaptive thinking), which it needs
  // to check the student's arithmetic. The visible reply is kept to four
  // sentences by the prompt, not by this limit.
  mentorMaxTokens: 1500,
  historyMessages: 8,
  messagesPerTask: 20,
  // Chat messages and answer checks together.
  requestsPerDay: 40,
  requestsPerMinute: 5,
  monthlyBudgetUsd: 30,
} as const;

// Days and months for limits are counted in this time zone.
export const APP_TIME_ZONE = "Europe/Moscow";
