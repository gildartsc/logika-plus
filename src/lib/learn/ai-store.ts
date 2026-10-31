import "server-only";
import { AI_LIMITS, APP_TIME_ZONE } from "@/config/ai";
import { computeCostUsd, type AiTask, type AiUsage, type ChatTurn } from "@/lib/ai";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkLimits, startOfDay, startOfMonth, type LimitCheck } from "./limits";

// Every read and write here uses the service role, so callers must have
// authorized the user and the task first (see access.ts).

export async function getMonthSpendUsd(now = new Date()): Promise<number> {
  const { data, error } = await createAdminClient().rpc("ai_spend_since", {
    since: startOfMonth(now, APP_TIME_ZONE).toISOString(),
  });
  if (error) throw new Error(`Failed to read AI spend: ${error.code}`);
  return Number(data ?? 0);
}

export async function isAiAvailable(): Promise<boolean> {
  return (await getMonthSpendUsd()) < AI_LIMITS.monthlyBudgetUsd;
}

async function countSince(table: "chat_history" | "submissions", userId: string, since: Date) {
  let query = createAdminClient()
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", since.toISOString());
  if (table === "chat_history") query = query.eq("role", "user");
  const { count, error } = await query;
  if (error) throw new Error(`Failed to count ${table}: ${error.code}`);
  return count ?? 0;
}

// Requests = messages the student sent to the mentor + answers sent for checking.
export async function checkAiLimits(
  userId: string,
  taskId: string,
  kind: "chat" | "grading",
  now = new Date(),
): Promise<LimitCheck> {
  const minuteAgo = new Date(now.getTime() - 60_000);
  const dayStart = startOfDay(now, APP_TIME_ZONE);

  const [monthSpendUsd, chatMinute, answersMinute, chatToday, answersToday, progress] = await Promise.all([
    getMonthSpendUsd(now),
    countSince("chat_history", userId, minuteAgo),
    countSince("submissions", userId, minuteAgo),
    countSince("chat_history", userId, dayStart),
    countSince("submissions", userId, dayStart),
    createAdminClient()
      .from("user_progress")
      .select("ai_messages_count")
      .eq("user_id", userId)
      .eq("task_id", taskId)
      .maybeSingle(),
  ]);
  if (progress.error) throw new Error(`Failed to read progress: ${progress.error.code}`);

  const result = checkLimits(
    {
      monthSpendUsd,
      requestsLastMinute: chatMinute + answersMinute,
      requestsToday: chatToday + answersToday,
      taskMessages: progress.data?.ai_messages_count ?? 0,
    },
    kind,
  );
  if (!result.ok && result.reason === "budget") {
    // Admin notification comes with the admin panel (stage 7); no student data here.
    console.warn("Monthly AI budget reached: chat and answer checks are disabled");
  }
  return result;
}

export async function getAiTask(taskId: string): Promise<AiTask> {
  const { data, error } = await createAdminClient()
    .from("tasks")
    .select("public_text, ai_context, grading_criteria, common_mistakes")
    .eq("id", taskId)
    .single<AiTask>();
  if (error || !data) throw new Error(`Failed to read task: ${error?.code}`);
  return data;
}

export async function recordUsage(
  userId: string,
  taskId: string,
  kind: "chat" | "grading",
  usages: AiUsage[],
): Promise<void> {
  if (usages.length === 0) return;
  const rows = usages.map((usage) => ({
    user_id: userId,
    task_id: taskId,
    kind,
    model: usage.model,
    input_tokens: usage.input_tokens,
    output_tokens: usage.output_tokens,
    cache_read_tokens: usage.cache_read_tokens,
    cost_usd: computeCostUsd(usage),
  }));
  const { error } = await createAdminClient().from("ai_usage").insert(rows);
  if (error) console.error("Failed to record AI usage:", error.code);
}

export async function addChatMessage(userId: string, taskId: string, turn: ChatTurn): Promise<void> {
  const { error } = await createAdminClient()
    .from("chat_history")
    .insert({ user_id: userId, task_id: taskId, role: turn.role, message: turn.message });
  if (error) throw new Error(`Failed to save chat message: ${error.code}`);
}

export async function getRecentTurns(userId: string, taskId: string): Promise<ChatTurn[]> {
  const { data, error } = await createAdminClient()
    .from("chat_history")
    .select("role, message")
    .eq("user_id", userId)
    .eq("task_id", taskId)
    .order("created_at", { ascending: false })
    .limit(AI_LIMITS.historyMessages);
  if (error) throw new Error(`Failed to read chat history: ${error.code}`);
  return (data as ChatTurn[]).reverse();
}
