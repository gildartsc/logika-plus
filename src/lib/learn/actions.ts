"use server";

import { z } from "zod";
import { AI_LIMITS } from "@/config/ai";
import { FILE_LIMITS } from "@/config/files";
import { askMentor, countGradingTokens, gradeAnswer, redactPersonalData, type AiFailure } from "@/lib/ai";
import {
  attachToSubmission,
  FileError,
  prepareUploadSlots,
  verifyUploads,
  type UploadSlot,
  type VerifiedFile,
} from "@/lib/files/store";
import { validateUploadRequest } from "@/lib/files/validate-request";
import { createAdminClient } from "@/lib/supabase/admin";
import { authorizeTask, TASK_UNAVAILABLE } from "./access";
import { FEEDBACK_PREFIX } from "./chat-format";
import { addChatMessage, checkAiLimits, getAiTask, getRecentTurns, recordUsage } from "./ai-store";
import { nextHintNumber } from "./hints";
import { pointsForSolve } from "./points";
import { updateProgress } from "./progress-store";
import { answerSchema, chatMessageSchema, uploadRequestSchema } from "./validation";

export type HintResult =
  | { ok: true; hint: string; hintsUsed: number }
  | { ok: false; error: string };

export type AnswerResult =
  | { ok: true; status: "solved" | "needs_work"; feedback: string; pointsAwarded: number }
  | { ok: false; error: string; saved: boolean };

export type UploadPrepareResult =
  | { ok: true; slots: UploadSlot[] }
  | { ok: false; error: string };

export type ChatResult =
  | { ok: true; reply: string; remaining: number }
  | { ok: false; error: string };

const SERVER_ERROR = "Не получилось сохранить. Попробуйте ещё раз";
const NOT_CHECKED = "Ответ сохранён, но проверить его не получилось.";
const AWARD_FAILED = "Решение принято, но результат не сохранился. Отправь ответ ещё раз";

const AI_FAILURE_MESSAGES: Record<AiFailure, string> = {
  refusal: "Наставник не может ответить на это сообщение. Попробуй сформулировать иначе",
  error: "Наставник сейчас недоступен. Попробуй ещё раз через минуту",
  invalid_output: "Наставник не смог ответить. Попробуй ещё раз",
};

export async function openHint(taskId: string): Promise<HintResult> {
  const access = await authorizeTask(taskId);
  if (!access.ok) return { ok: false, error: access.error };

  try {
    const { row, patch } = await updateProgress(access.userId, access.taskId, (current) => {
      const next = nextHintNumber(current.hints_used);
      if (next === null) return null;
      return {
        hints_used: next,
        status: current.status === "not_started" ? "in_progress" : current.status,
      };
    });
    if (!patch) return { ok: false, error: "Все подсказки уже открыты" };

    const column = `hint_${row.hints_used}` as "hint_1" | "hint_2" | "hint_3";
    const { data, error } = await createAdminClient()
      .from("tasks")
      .select(column)
      .eq("id", access.taskId)
      .single<Record<typeof column, string>>();
    if (error || !data) throw new Error(`Failed to read hint: ${error?.code}`);

    return { ok: true, hint: data[column], hintsUsed: row.hints_used };
  } catch (error) {
    console.error("openHint failed:", (error as Error).message);
    return { ok: false, error: SERVER_ERROR };
  }
}

export async function sendMentorMessage(taskId: string, message: string): Promise<ChatResult> {
  const parsed = chatMessageSchema.safeParse({ taskId, message });
  if (!parsed.success) {
    const errors = z.flattenError(parsed.error).fieldErrors;
    return { ok: false, error: errors.message?.[0] ?? TASK_UNAVAILABLE };
  }
  const access = await authorizeTask(parsed.data.taskId);
  if (!access.ok) return access;
  const { userId } = access;

  try {
    const limits = await checkAiLimits(userId, access.taskId, "chat");
    if (!limits.ok) return { ok: false, error: limits.message };

    const task = await getAiTask(access.taskId);
    // Phones and e-mails are masked before storage and before the AI sees them.
    const message = redactPersonalData(parsed.data.message);
    await addChatMessage(userId, access.taskId, { role: "user", message });
    const turns = await getRecentTurns(userId, access.taskId);

    const result = await askMentor(task, turns);
    await recordUsage(userId, access.taskId, "chat", result.usage ? [result.usage] : []);
    if (!result.ok) return { ok: false, error: AI_FAILURE_MESSAGES[result.reason] };

    await addChatMessage(userId, access.taskId, { role: "ai", message: result.text });
    const { row } = await updateProgress(userId, access.taskId, (current) => ({
      ai_messages_count: current.ai_messages_count + 1,
      status: current.status === "not_started" ? "in_progress" : current.status,
    }));
    return {
      ok: true,
      reply: result.text,
      remaining: Math.max(AI_LIMITS.messagesPerTask - row.ai_messages_count, 0),
    };
  } catch (error) {
    // Never log message texts.
    console.error("sendMentorMessage failed:", (error as Error).message);
    return { ok: false, error: AI_FAILURE_MESSAGES.error };
  }
}

// Step 1 of sending files: one-time upload URLs into the student's folder.
// The browser uploads straight to storage (no request-size limits on our
// server); submitAnswer then checks every file by content.
export async function prepareUploads(
  taskId: string,
  files: { name: string; size: number }[],
): Promise<UploadPrepareResult> {
  const parsed = uploadRequestSchema.safeParse({ taskId, files });
  if (!parsed.success) {
    const errors = z.flattenError(parsed.error).fieldErrors;
    return { ok: false, error: errors.files?.[0] ?? TASK_UNAVAILABLE };
  }
  const invalid = validateUploadRequest(parsed.data.files);
  if (invalid) return { ok: false, error: invalid };

  const access = await authorizeTask(parsed.data.taskId);
  if (!access.ok) return access;

  try {
    const limits = await checkAiLimits(access.userId, access.taskId, "grading");
    if (!limits.ok) return { ok: false, error: limits.message };
    return { ok: true, slots: await prepareUploadSlots(access.userId, access.taskId, parsed.data.files) };
  } catch (error) {
    console.error("prepareUploads failed:", (error as Error).message);
    return { ok: false, error: SERVER_ERROR };
  }
}

export async function submitAnswer(taskId: string, answer: string, uploadIds: string[] = []): Promise<AnswerResult> {
  const parsed = answerSchema.safeParse({ taskId, answer, uploadIds });
  if (!parsed.success) {
    const errors = z.flattenError(parsed.error).fieldErrors;
    return {
      ok: false,
      error: errors.answer?.[0] ?? errors.uploadIds?.[0] ?? errors.taskId?.[0] ?? TASK_UNAVAILABLE,
      saved: false,
    };
  }
  const access = await authorizeTask(parsed.data.taskId);
  if (!access.ok) return { ...access, saved: false };
  const { userId } = access;
  const answerText = redactPersonalData(parsed.data.answer);

  let submissionId: string;
  let files: VerifiedFile[];
  let task: Awaited<ReturnType<typeof getAiTask>>;
  try {
    const limits = await checkAiLimits(userId, access.taskId, "grading");
    if (!limits.ok) return { ok: false, error: limits.message, saved: false };

    task = await getAiTask(access.taskId);
    files = await verifyUploads(userId, access.taskId, parsed.data.uploadIds);
    if (files.length > 0) {
      const tokens = await countGradingTokens(task, answerText, files.map((f) => f.grader));
      if (tokens === null) return { ok: false, error: AI_FAILURE_MESSAGES.error, saved: false };
      if (tokens > FILE_LIMITS.maxGradingInputTokens) {
        return {
          ok: false,
          error: "Файлы слишком большие для проверки: уменьшите число страниц или фото",
          saved: false,
        };
      }
    }

    const { data, error } = await createAdminClient()
      .from("submissions")
      .insert({ user_id: userId, task_id: access.taskId, answer_text: answerText })
      .select("id")
      .single<{ id: string }>();
    if (error || !data) throw new Error(`Failed to save submission: ${error?.code}`);
    submissionId = data.id;
    await attachToSubmission(files, submissionId);
  } catch (error) {
    if (error instanceof FileError) return { ok: false, error: error.message, saved: false };
    // Never log the answer text itself.
    console.error("submitAnswer failed:", (error as Error).message);
    return { ok: false, error: SERVER_ERROR, saved: false };
  }

  try {
    const result = await gradeAnswer(task, answerText, files.map((f) => f.grader));
    await recordUsage(userId, access.taskId, "grading", result.usages);

    if (!result.ok) {
      await updateProgress(userId, access.taskId, (current) => ({
        attempts_count: current.attempts_count + 1,
        status: current.status === "solved" ? "solved" : "in_progress",
      }));
      return { ok: false, error: `${NOT_CHECKED} ${AI_FAILURE_MESSAGES[result.reason]}`, saved: true };
    }

    const { grade } = result;
    const feedback = FEEDBACK_PREFIX + grade.feedback;
    const { error: feedbackError } = await createAdminClient()
      .from("submissions")
      .update({ ai_feedback: grade.feedback, ai_status: grade.status, criteria_met: grade.criteriaMet })
      .eq("id", submissionId);
    if (feedbackError) throw new Error(`Failed to save feedback: ${feedbackError.code}`);
    await addChatMessage(userId, access.taskId, { role: "ai", message: feedback });

    // A solved task stays solved: a later weaker answer does not undo it.
    const { row } = await updateProgress(userId, access.taskId, (current) => ({
      attempts_count: current.attempts_count + 1,
      status: current.status === "solved" ? "solved" : "in_progress",
    }));

    let pointsAwarded = 0;
    if (grade.status === "solved") {
      // Points are computed here, by code; the database function marks the
      // task solved and adds them only on the first correct answer.
      const points = pointsForSolve(row.ai_messages_count);
      const { data: awarded, error: awardError } = await createAdminClient().rpc("award_task_points", {
        p_user_id: userId,
        p_task_id: access.taskId,
        p_points: points,
      });
      if (awardError) {
        console.error("award_task_points failed:", awardError.code);
        return { ok: false, error: AWARD_FAILED, saved: true };
      }
      if (awarded === true) pointsAwarded = points;
    }

    return { ok: true, status: grade.status, feedback, pointsAwarded };
  } catch (error) {
    console.error("submitAnswer grading failed:", (error as Error).message);
    return { ok: false, error: `${NOT_CHECKED} ${AI_FAILURE_MESSAGES.error}`, saved: true };
  }
}
