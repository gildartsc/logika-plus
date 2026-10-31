import type Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { AI_LIMITS, AI_MODELS } from "../../config/ai.ts";
import { describeApiError, usageFrom } from "./client.ts";
import { buildGraderSystem, parseCriteria, wrapAnswer } from "./prompts.ts";
import type { AiAttachment, AiFailure, AiTask, AiUsage } from "./types.ts";

// Shape the model must return (structured outputs).
const graderOutputSchema = z.object({
  status: z.enum(["solved", "needs_work"]),
  feedback: z.string(),
  criteria_met: z.array(z.number().int()),
});

// Our own, stricter validation of what came back.
const gradeSchema = z.object({
  status: z.enum(["solved", "needs_work"]),
  feedback: z.string().trim().min(1).max(1500),
  criteria_met: z.array(z.number().int()),
});

export type Grade = { status: "solved" | "needs_work"; feedback: string; criteriaMet: number[] };

export type GradeResult =
  | { ok: true; grade: Grade; usages: AiUsage[] }
  | { ok: false; reason: AiFailure; usages: AiUsage[] };

const MAX_ATTEMPTS = 2; // one retry on invalid output, as CLAUDE.md requires

// Images and PDFs go first as their own blocks; DOCX text goes inside <answer>.
export function buildAnswerContent(answer: string, files: AiAttachment[]): Anthropic.Beta.BetaContentBlockParam[] {
  const blocks: Anthropic.Beta.BetaContentBlockParam[] = [];
  for (const file of files) {
    if (file.kind === "image") {
      blocks.push({ type: "image", source: { type: "base64", media_type: file.mime, data: file.base64 } });
    } else if (file.kind === "pdf") {
      blocks.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: file.base64 } });
    }
  }
  const documents = files.filter((f): f is Extract<AiAttachment, { kind: "docx" }> => f.kind === "docx");
  blocks.push({ type: "text", text: wrapAnswer(answer, documents) });
  return blocks;
}

export function buildGraderRequest(task: AiTask, answer: string, files: AiAttachment[] = []) {
  return {
    model: AI_MODELS.grader,
    max_tokens: AI_LIMITS.maxTokens,
    // Sonnet 5.5 thinks by default and thinking counts toward max_tokens;
    // between_tools turns it off so the 400 tokens go to the JSON answer.
    thinking: { type: "between_tools" as const },
    output_config: { effort: "medium" as const, format: betaZodOutputFormat(graderOutputSchema) },
    // Server-side fallback for cyber / frontier_llm refusals.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default" as const,
    system: [
      { type: "text" as const, text: buildGraderSystem(task), cache_control: { type: "ephemeral" as const } },
    ],
    messages: [{ role: "user" as const, content: buildAnswerContent(answer, files) }],
  };
}

// Input tokens of the grading request, measured before it is sent so that a
// heavy PDF or many photos cannot exceed the per-check cost ceiling.
export async function countGradingTokens(
  client: Anthropic,
  task: AiTask,
  answer: string,
  files: AiAttachment[],
): Promise<number | null> {
  const request = buildGraderRequest(task, answer, files);
  try {
    const result = await client.beta.messages.countTokens({
      model: request.model,
      system: request.system,
      messages: request.messages,
    });
    return result.input_tokens;
  } catch (error) {
    console.error("Token count failed:", describeApiError(error));
    return null;
  }
}

// Parses and validates the model output; returns null if it is unusable.
export function parseGrade(text: string, criteriaCount: number): Grade | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  const parsed = gradeSchema.safeParse(raw);
  if (!parsed.success) return null;

  const criteriaMet = [...new Set(parsed.data.criteria_met)]
    .filter((n) => n >= 1 && n <= criteriaCount)
    .sort((a, b) => a - b);
  // A "solved" verdict with no criteria met is not credible.
  const status = parsed.data.status === "solved" && criteriaMet.length === 0 ? "needs_work" : parsed.data.status;
  return { status, feedback: parsed.data.feedback, criteriaMet };
}

export async function gradeAnswer(
  client: Anthropic,
  task: AiTask,
  answer: string,
  files: AiAttachment[] = [],
): Promise<GradeResult> {
  const usages: AiUsage[] = [];
  const criteriaCount = parseCriteria(task.grading_criteria).length;
  const request = buildGraderRequest(task, answer, files);

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    let response: Anthropic.Beta.BetaMessage;
    try {
      response = await client.beta.messages.create(request);
    } catch (error) {
      console.error("Grader request failed:", describeApiError(error));
      return { ok: false, reason: "error", usages };
    }
    usages.push(usageFrom(response.model, response.usage));

    if (response.stop_reason === "refusal") {
      return { ok: false, reason: "refusal", usages };
    }
    const text = response.content
      .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === "text")
      .map((block) => block.text)
      .join("");
    const grade = response.stop_reason === "max_tokens" ? null : parseGrade(text, criteriaCount);
    if (grade) return { ok: true, grade, usages };
  }
  return { ok: false, reason: "invalid_output", usages };
}
