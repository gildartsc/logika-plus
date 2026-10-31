import "server-only";
import { cache } from "react";
import { z } from "zod";
import { requireUser } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { openedHints } from "./hints";
import { computeTopicStatuses, type TopicStatus } from "./progress";

const topicRowSchema = z.object({
  id: z.string(),
  order_number: z.number().int(),
  title: z.string(),
  description: z.string(),
});

const taskRowSchema = z.object({
  id: z.string(),
  topic_id: z.string(),
  type: z.enum(["critical", "engineering"]),
  public_text: z.string(),
});

const progressRowSchema = z.object({
  task_id: z.string(),
  status: z.enum(["not_started", "in_progress", "solved"]),
  hints_used: z.number().int(),
  ai_messages_count: z.number().int(),
  completed_at: z.string().nullable(),
});

const chatRowSchema = z.object({
  task_id: z.string(),
  role: z.enum(["user", "ai"]),
  message: z.string(),
});

const hintRowSchema = z.object({
  id: z.string(),
  hint_1: z.string(),
  hint_2: z.string(),
  hint_3: z.string(),
});

export type TaskType = z.infer<typeof taskRowSchema>["type"];
export type TaskStatus = z.infer<typeof progressRowSchema>["status"];

export type CourseTask = z.infer<typeof taskRowSchema> & {
  status: TaskStatus;
  hints_used: number;
  ai_messages_count: number;
  completed_at: string | null;
};

export type ChatMessage = { role: "user" | "ai"; message: string };

export type CourseTopic = z.infer<typeof topicRowSchema> & {
  status: TopicStatus;
  tasks: CourseTask[];
};

function parseRows<T>(schema: z.ZodType<T>, rows: unknown, what: string): T[] {
  const parsed = z.array(schema).safeParse(rows);
  if (!parsed.success) {
    throw new Error(`Unexpected ${what} rows from the database`);
  }
  return parsed.data;
}

// The whole course for the signed-in student, read through RLS.
// Cached per request: the page and server actions share one lookup.
export const getCourse = cache(async () => {
  const profile = await requireUser();
  const supabase = await createClient();

  const [topicsRes, tasksRes, progressRes] = await Promise.all([
    supabase.from("topics").select("id, order_number, title, description").order("order_number"),
    supabase.from("tasks").select("id, topic_id, type, public_text"),
    supabase
      .from("user_progress")
      .select("task_id, status, hints_used, ai_messages_count, completed_at")
      .eq("user_id", profile.id),
  ]);
  const error = topicsRes.error ?? tasksRes.error ?? progressRes.error;
  if (error) {
    throw new Error(`Failed to load course: ${error.code}`);
  }

  const topics = parseRows(topicRowSchema, topicsRes.data, "topic");
  const tasks = parseRows(taskRowSchema, tasksRes.data, "task");
  const progress = new Map(
    parseRows(progressRowSchema, progressRes.data, "progress").map((row) => [row.task_id, row]),
  );

  const solved = new Set(
    [...progress.values()].filter((row) => row.status === "solved").map((row) => row.task_id),
  );
  const statuses = computeTopicStatuses(topics, tasks, solved);

  const courseTopics: CourseTopic[] = topics.map((topic) => ({
    ...topic,
    status: statuses.get(topic.id) ?? "locked",
    tasks: tasks
      .filter((task) => task.topic_id === topic.id)
      // Critical first, matching the tab order.
      .sort((a, b) => (a.type === b.type ? 0 : a.type === "critical" ? -1 : 1))
      .map((task) => ({
        ...task,
        status: progress.get(task.id)?.status ?? "not_started",
        hints_used: progress.get(task.id)?.hints_used ?? 0,
        ai_messages_count: progress.get(task.id)?.ai_messages_count ?? 0,
        completed_at: progress.get(task.id)?.completed_at ?? null,
      })),
  }));

  return { profile, topics: courseTopics, statuses };
});

// Finds a task the student is allowed to work on. Returns null for unknown
// tasks and for tasks in locked topics.
export async function findOpenTask(taskId: string) {
  const { profile, topics } = await getCourse();
  for (const topic of topics) {
    const task = topic.tasks.find((t) => t.id === taskId);
    if (task) {
      return { profile, task, locked: topic.status === "locked" };
    }
  }
  return null;
}

// Hint texts are hidden from clients, so opened ones are read with the
// service role and only for tasks of the given (already authorized) topic.
export async function getOpenedHints(tasks: CourseTask[]): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>();
  const withHints = tasks.filter((task) => task.hints_used > 0);
  if (withHints.length === 0) return result;

  const { data, error } = await createAdminClient()
    .from("tasks")
    .select("id, hint_1, hint_2, hint_3")
    .in(
      "id",
      withHints.map((task) => task.id),
    );
  if (error) {
    throw new Error(`Failed to load hints: ${error.code}`);
  }
  const rows = parseRows(hintRowSchema, data, "hint");
  for (const task of withHints) {
    const row = rows.find((r) => r.id === task.id);
    if (row) result.set(task.id, openedHints(row, task.hints_used));
  }
  return result;
}

const CHAT_HISTORY_LIMIT = 200;

// The student's own chat for the given tasks, oldest first, read through RLS.
export async function getChatHistory(taskIds: string[]): Promise<Map<string, ChatMessage[]>> {
  const result = new Map<string, ChatMessage[]>(taskIds.map((id) => [id, []]));
  if (taskIds.length === 0) return result;

  const { profile } = await getCourse();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("chat_history")
    .select("task_id, role, message")
    .eq("user_id", profile.id)
    .in("task_id", taskIds)
    .order("created_at", { ascending: false })
    .limit(CHAT_HISTORY_LIMIT);
  if (error) {
    throw new Error(`Failed to load chat: ${error.code}`);
  }
  for (const row of parseRows(chatRowSchema, data, "chat").reverse()) {
    result.get(row.task_id)?.push({ role: row.role, message: row.message });
  }
  return result;
}

export type MyFile = { id: string; name: string; mime: string; createdAt: string };

// The student's own files sent with answers, newest first, read through RLS.
export async function getMyFiles(taskIds: string[]): Promise<Map<string, MyFile[]>> {
  const result = new Map<string, MyFile[]>(taskIds.map((id) => [id, []]));
  if (taskIds.length === 0) return result;

  const { profile } = await getCourse();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("attachments")
    .select("id, task_id, file_name, mime_type, created_at")
    .eq("user_id", profile.id)
    .in("task_id", taskIds)
    .not("submission_id", "is", null)
    .order("created_at", { ascending: false });
  if (error) {
    throw new Error(`Failed to load files: ${error.code}`);
  }
  for (const row of (data ?? []) as { id: string; task_id: string; file_name: string; mime_type: string; created_at: string }[]) {
    result.get(row.task_id)?.push({ id: row.id, name: row.file_name, mime: row.mime_type, createdAt: row.created_at });
  }
  return result;
}
