import type Anthropic from "@anthropic-ai/sdk";
import { AI_LIMITS, AI_MODELS } from "../../config/ai.ts";
import { describeApiError, usageFrom } from "./client.ts";
import { toApiMessages } from "./history.ts";
import { buildMentorSystem } from "./prompts.ts";
import type { AiFailure, AiTask, AiUsage, ChatTurn } from "./types.ts";

export type MentorResult =
  | { ok: true; text: string; usage: AiUsage }
  | { ok: false; reason: AiFailure; usage: AiUsage | null };

export function buildMentorRequest(task: AiTask, turns: ChatTurn[]) {
  return {
    model: AI_MODELS.mentor,
    max_tokens: AI_LIMITS.mentorMaxTokens,
    // Short hidden reasoning lets the mentor check the student's numbers
    // before praising them. Without it, or at low effort, it praised a
    // calculation off by a factor of ten or gave away the correct result.
    thinking: { type: "adaptive" as const },
    output_config: { effort: "medium" as const },
    // Server-side fallback for cyber / frontier_llm refusals.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default" as const,
    // Static part first and unchanged between messages, marked for caching
    // (Sonnet 5.5 caches prefixes from 512 tokens).
    system: [
      { type: "text" as const, text: buildMentorSystem(task), cache_control: { type: "ephemeral" as const } },
    ],
    messages: toApiMessages(turns, AI_LIMITS.historyMessages),
  };
}

export async function askMentor(
  client: Anthropic,
  task: AiTask,
  turns: ChatTurn[],
): Promise<MentorResult> {
  let response: Anthropic.Beta.BetaMessage;
  try {
    response = await client.beta.messages.create(buildMentorRequest(task, turns));
  } catch (error) {
    console.error("Mentor request failed:", describeApiError(error));
    return { ok: false, reason: "error", usage: null };
  }

  const usage = usageFrom(response.model, response.usage);
  if (response.stop_reason === "refusal") {
    return { ok: false, reason: "refusal", usage };
  }
  // A reply cut off by the token limit is not shown half-finished.
  if (response.stop_reason === "max_tokens") {
    return { ok: false, reason: "invalid_output", usage };
  }
  // Thinking blocks are hidden; only the text reaches the student.
  const text = response.content
    .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();
  if (!text) {
    return { ok: false, reason: "invalid_output", usage };
  }
  return { ok: true, text, usage };
}
