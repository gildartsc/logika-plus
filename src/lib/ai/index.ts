// Server entry point of the AI module. App code calls the model only
// through these functions; nothing else imports the SDK.
import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { createAnthropicClient } from "./client.ts";
import { countGradingTokens as countWith, gradeAnswer as gradeWith } from "./grader.ts";
import { askMentor as askWith } from "./mentor.ts";
import type { AiAttachment, AiTask, ChatTurn } from "./types.ts";

export { computeCostUsd } from "./cost.ts";
export { redactPersonalData } from "./redact.ts";
export type { Grade, GradeResult } from "./grader.ts";
export type { MentorResult } from "./mentor.ts";
export type { AiAttachment, AiFailure, AiTask, AiUsage, ChatTurn } from "./types.ts";

let client: Anthropic | null = null;

function getClient(): Anthropic {
  client ??= createAnthropicClient();
  return client;
}

export function askMentor(task: AiTask, turns: ChatTurn[]) {
  return askWith(getClient(), task, turns);
}

export function gradeAnswer(task: AiTask, answer: string, files: AiAttachment[] = []) {
  return gradeWith(getClient(), task, answer, files);
}

export function countGradingTokens(task: AiTask, answer: string, files: AiAttachment[]) {
  return countWith(getClient(), task, answer, files);
}
