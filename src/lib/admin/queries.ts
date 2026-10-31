import "server-only";
import { notFound } from "next/navigation";
import { AI_LIMITS, APP_TIME_ZONE } from "@/config/ai";
import { requireAdmin } from "@/lib/auth/guards";
import { getMonthSpendUsd } from "@/lib/learn/ai-store";
import { startOfDay, startOfMonth } from "@/lib/learn/limits";
import { computeTopicStatuses } from "@/lib/learn/progress";
import { computeProfileStats } from "@/lib/learn/stats";
import { createAdminClient } from "@/lib/supabase/admin";
import { budgetLevel, countActiveSince } from "./activity";
import { studentCode, toCsv } from "./csv";

// Every function here starts with requireAdmin(): the admin layout gate does
// not re-run on navigation between admin pages, and data needs the service role.

type TaskType = "critical" | "engineering";
type TaskStatus = "not_started" | "in_progress" | "solved";

type TopicRow = { id: string; order_number: number; title: string; description: string };
type TaskRef = { id: string; topic_id: string; type: TaskType };
type ProgressRow = {
  user_id: string;
  task_id: string;
  status: TaskStatus;
  attempts_count: number;
  hints_used: number;
  ai_messages_count: number;
  points_earned: number;
  completed_at: string | null;
};
type StudentRow = {
  id: string;
  name: string;
  email: string;
  class: string;
  total_points: number;
  is_blocked: boolean;
  created_at: string;
};

const PAGE = 1000;

type AttachmentRef = {
  id: string;
  submission_id: string | null;
  user_id: string;
  task_id: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
};

const FILE_LABELS: Record<string, string> = {
  "image/jpeg": "JPG",
  "image/png": "PNG",
  "application/pdf": "PDF",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
};

export function fileTypeLabel(mime: string): string {
  return FILE_LABELS[mime] ?? "файл";
}

// PostgREST returns at most 1000 rows per request, so read in pages.
async function fetchAll<T>(
  read: (from: number, to: number) => PromiseLike<{ data: unknown; error: { code: string } | null }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await read(from, from + PAGE - 1);
    if (error) throw new Error(`Admin query failed: ${error.code}`);
    const page = (data ?? []) as T[];
    rows.push(...page);
    if (page.length < PAGE) return rows;
  }
}

async function loadCourseRefs() {
  const db = createAdminClient();
  const [topics, tasks] = await Promise.all([
    fetchAll<TopicRow>((a, b) =>
      db.from("topics").select("id, order_number, title, description").order("order_number").range(a, b),
    ),
    fetchAll<TaskRef>((a, b) => db.from("tasks").select("id, topic_id, type").order("id").range(a, b)),
  ]);
  return { topics, tasks };
}

async function loadStudents(): Promise<StudentRow[]> {
  const db = createAdminClient();
  return fetchAll<StudentRow>((a, b) =>
    db
      .from("users")
      .select("id, name, email, class, total_points, is_blocked, created_at")
      .eq("role", "student")
      .order("name")
      .range(a, b),
  );
}

async function loadLastActivity() {
  const { data, error } = await createAdminClient().rpc("student_last_activity");
  if (error) throw new Error(`Failed to read activity: ${error.code}`);
  return (data ?? []) as { user_id: string; last_activity: string }[];
}

function completedTopicsCount(topics: TopicRow[], tasks: TaskRef[], solved: Set<string>): number {
  const statuses = computeTopicStatuses(topics, tasks, solved);
  return [...statuses.values()].filter((s) => s === "completed").length;
}

// --- Dashboard ---------------------------------------------------------------

export async function getBudgetStatus() {
  await requireAdmin();
  const spendUsd = await getMonthSpendUsd();
  return {
    spendUsd,
    budgetUsd: AI_LIMITS.monthlyBudgetUsd,
    level: budgetLevel(spendUsd, AI_LIMITS.monthlyBudgetUsd),
  };
}

export async function getDashboard() {
  await requireAdmin();
  const [students, activity, budget] = await Promise.all([loadStudents(), loadLastActivity(), getBudgetStatus()]);
  const ids = new Set(students.map((s) => s.id));
  return {
    studentsTotal: students.length,
    activeToday: countActiveSince(activity, ids, startOfDay(new Date(), APP_TIME_ZONE)),
    budget,
  };
}

// --- Topics and tasks --------------------------------------------------------

export type AdminTask = {
  id: string;
  type: TaskType;
  public_text: string;
  ai_context: string;
  grading_criteria: string;
  common_mistakes: string;
  hint_1: string;
  hint_2: string;
  hint_3: string;
};

export async function listTopicsAdmin() {
  await requireAdmin();
  const { topics, tasks } = await loadCourseRefs();
  return topics.map((topic) => {
    const types = new Set(tasks.filter((t) => t.topic_id === topic.id).map((t) => t.type));
    return { ...topic, hasCritical: types.has("critical"), hasEngineering: types.has("engineering") };
  });
}

// Rows of student data that deleting these tasks would destroy.
export async function countStudentData(taskIds: string[]): Promise<number> {
  await requireAdmin();
  if (taskIds.length === 0) return 0;
  const db = createAdminClient();
  const counts = await Promise.all(
    (["user_progress", "submissions", "chat_history"] as const).map(async (table) => {
      const { count, error } = await db
        .from(table)
        .select("id", { count: "exact", head: true })
        .in("task_id", taskIds);
      if (error) throw new Error(`Failed to count ${table}: ${error.code}`);
      return count ?? 0;
    }),
  );
  return counts.reduce((sum, n) => sum + n, 0);
}

export async function getTopicAdmin(topicId: string) {
  await requireAdmin();
  const db = createAdminClient();
  const { data: topic, error } = await db
    .from("topics")
    .select("id, order_number, title, description")
    .eq("id", topicId)
    .maybeSingle<TopicRow>();
  if (error) throw new Error(`Failed to read topic: ${error.code}`);
  if (!topic) notFound();

  const { data: tasks, error: tasksError } = await db
    .from("tasks")
    .select("id, type, public_text, ai_context, grading_criteria, common_mistakes, hint_1, hint_2, hint_3")
    .eq("topic_id", topicId);
  if (tasksError) throw new Error(`Failed to read tasks: ${tasksError.code}`);
  const list = (tasks ?? []) as AdminTask[];

  const studentRows = await countStudentData(list.map((t) => t.id));
  const perTask = await Promise.all(list.map(async (t) => [t.id, await countStudentData([t.id])] as const));
  return {
    topic,
    tasks: {
      critical: list.find((t) => t.type === "critical") ?? null,
      engineering: list.find((t) => t.type === "engineering") ?? null,
    },
    hasStudentData: studentRows > 0,
    taskHasStudentData: Object.fromEntries(perTask.map(([id, n]) => [id, n > 0])),
  };
}

// --- Students ----------------------------------------------------------------

export async function listStudentsAdmin() {
  await requireAdmin();
  const db = createAdminClient();
  const [students, { topics, tasks }, progress, activity] = await Promise.all([
    loadStudents(),
    loadCourseRefs(),
    fetchAll<Pick<ProgressRow, "user_id" | "task_id" | "status">>((a, b) =>
      db.from("user_progress").select("user_id, task_id, status").eq("status", "solved").order("id").range(a, b),
    ),
    loadLastActivity(),
  ]);
  const lastActivity = new Map(activity.map((row) => [row.user_id, row.last_activity]));

  return {
    totalTopics: topics.length,
    students: students.map((student) => {
      const solved = new Set(progress.filter((p) => p.user_id === student.id).map((p) => p.task_id));
      return {
        ...student,
        completedTopics: completedTopicsCount(topics, tasks, solved),
        lastActivity: lastActivity.get(student.id) ?? null,
      };
    }),
  };
}

export async function getStudentAdmin(userId: string) {
  await requireAdmin();
  const db = createAdminClient();
  const { data: student, error } = await db
    .from("users")
    .select("id, name, email, class, total_points, is_blocked, created_at, role")
    .eq("id", userId)
    .maybeSingle<StudentRow & { role: string }>();
  if (error) throw new Error(`Failed to read student: ${error.code}`);
  if (!student || student.role !== "student") notFound();

  const monthStart = startOfMonth(new Date(), APP_TIME_ZONE).toISOString();
  const [{ topics, tasks }, progress, usage] = await Promise.all([
    loadCourseRefs(),
    fetchAll<ProgressRow>((a, b) =>
      db
        .from("user_progress")
        .select("user_id, task_id, status, attempts_count, hints_used, ai_messages_count, points_earned, completed_at")
        .eq("user_id", userId)
        .order("id")
        .range(a, b),
    ),
    fetchAll<{ cost_usd: number }>((a, b) =>
      db.from("ai_usage").select("cost_usd").eq("user_id", userId).gte("created_at", monthStart).order("id").range(a, b),
    ),
  ]);

  const byTask = new Map(progress.map((p) => [p.task_id, p]));
  const statuses = computeTopicStatuses(
    topics,
    tasks,
    new Set(progress.filter((p) => p.status === "solved").map((p) => p.task_id)),
  );
  const courseTopics = topics.map((topic) => ({
    order_number: topic.order_number,
    title: topic.title,
    status: statuses.get(topic.id) ?? ("locked" as const),
    tasks: tasks
      .filter((t) => t.topic_id === topic.id)
      .map((t) => {
        const p = byTask.get(t.id);
        return {
          type: t.type,
          status: p?.status ?? ("not_started" as const),
          hints_used: p?.hints_used ?? 0,
          ai_messages_count: p?.ai_messages_count ?? 0,
          attempts_count: p?.attempts_count ?? 0,
          points_earned: p?.points_earned ?? 0,
          completed_at: p?.completed_at ?? null,
        };
      }),
  }));

  const [submissions, attachments] = await Promise.all([
    fetchAll<{ id: string; task_id: string; ai_status: string | null; created_at: string }>((a, b) =>
      db
        .from("submissions")
        .select("id, task_id, ai_status, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .range(a, b),
    ),
    fetchAll<AttachmentRef>((a, b) =>
      db
        .from("attachments")
        .select("id, submission_id, user_id, task_id, file_name, mime_type, size_bytes, created_at")
        .eq("user_id", userId)
        .not("submission_id", "is", null)
        .order("created_at")
        .range(a, b),
    ),
  ]);
  const topicById = new Map(topics.map((t) => [t.id, t]));
  const taskById = new Map(tasks.map((t) => [t.id, t]));

  return {
    student,
    stats: computeProfileStats(courseTopics),
    topics: courseTopics,
    monthSpendUsd: usage.reduce((sum, row) => sum + Number(row.cost_usd), 0),
    answers: submissions.slice(0, 50).map((sub) => {
      const task = taskById.get(sub.task_id);
      return {
        id: sub.id,
        createdAt: sub.created_at,
        status: sub.ai_status,
        topic: task ? topicById.get(task.topic_id) : undefined,
        type: task?.type,
        files: attachments.filter((f) => f.submission_id === sub.id),
      };
    }),
  };
}

// --- Files -------------------------------------------------------------------

// Every file sent with an answer: who, when and for which task.
export async function listFilesAdmin() {
  await requireAdmin();
  const db = createAdminClient();
  const [files, { topics, tasks }, users] = await Promise.all([
    fetchAll<AttachmentRef>((a, b) =>
      db
        .from("attachments")
        .select("id, submission_id, user_id, task_id, file_name, mime_type, size_bytes, created_at")
        .not("submission_id", "is", null)
        .order("created_at", { ascending: false })
        .range(a, b),
    ),
    loadCourseRefs(),
    fetchAll<{ id: string; name: string; class: string }>((a, b) =>
      db.from("users").select("id, name, class").order("id").range(a, b),
    ),
  ]);
  const topicById = new Map(topics.map((t) => [t.id, t]));
  const taskById = new Map(tasks.map((t) => [t.id, t]));
  const userById = new Map(users.map((u) => [u.id, u]));

  return files.map((file) => {
    const task = taskById.get(file.task_id);
    return {
      ...file,
      student: userById.get(file.user_id),
      topic: task ? topicById.get(task.topic_id) : undefined,
      type: task?.type,
    };
  });
}

// --- CSV export (pseudonymized) ----------------------------------------------

const exportTime = new Intl.DateTimeFormat("sv-SE", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

const TYPE_LABELS: Record<TaskType, string> = { critical: "критическое", engineering: "инженерное" };

async function exportContext() {
  const [students, { topics, tasks }] = await Promise.all([loadStudents(), loadCourseRefs()]);
  const topicById = new Map(topics.map((t) => [t.id, t]));
  const taskInfo = new Map(
    tasks.map((t) => [t.id, { topic: topicById.get(t.topic_id), type: TYPE_LABELS[t.type] }]),
  );
  // Only students: the admin's own test activity stays out of research data.
  const classById = new Map(students.map((s) => [s.id, s.class]));
  return { taskInfo, classById };
}

export async function buildAttemptsCsv(): Promise<string> {
  await requireAdmin();
  const db = createAdminClient();
  const [{ taskInfo, classById }, files, rows] = await Promise.all([
    exportContext(),
    fetchAll<{ submission_id: string; mime_type: string }>((a, b) =>
      db.from("attachments").select("submission_id, mime_type").not("submission_id", "is", null).order("id").range(a, b),
    ),
    fetchAll<{
      id: string;
      user_id: string;
      task_id: string;
      answer_text: string;
      ai_status: string | null;
      criteria_met: number[] | null;
      ai_feedback: string | null;
      created_at: string;
    }>((a, b) =>
      db
        .from("submissions")
        .select("id, user_id, task_id, answer_text, ai_status, criteria_met, ai_feedback, created_at")
        .order("created_at")
        .order("id")
        .range(a, b),
    ),
  ]);

  return toCsv(
    ["код_ученика", "класс", "тема", "название_темы", "тип_задачи", "время", "ответ", "файлы", "вердикт", "выполненные_критерии", "отзыв_ИИ"],
    rows
      .filter((r) => classById.has(r.user_id))
      .map((r) => {
        const info = taskInfo.get(r.task_id);
        return [
          studentCode(r.user_id),
          classById.get(r.user_id),
          info?.topic?.order_number,
          info?.topic?.title,
          info?.type,
          exportTime.format(new Date(r.created_at)),
          r.answer_text,
          // File names may contain personal data, so only types are exported.
          files
            .filter((f) => f.submission_id === r.id)
            .map((f) => fileTypeLabel(f.mime_type))
            .join(", "),
          r.ai_status,
          r.criteria_met?.join(","),
          r.ai_feedback,
        ];
      }),
  );
}

export async function buildChatsCsv(): Promise<string> {
  await requireAdmin();
  const db = createAdminClient();
  const [{ taskInfo, classById }, rows] = await Promise.all([
    exportContext(),
    fetchAll<{ user_id: string; task_id: string; role: "user" | "ai"; message: string; created_at: string }>((a, b) =>
      db
        .from("chat_history")
        .select("user_id, task_id, role, message, created_at")
        .order("created_at")
        .order("id")
        .range(a, b),
    ),
  ]);

  return toCsv(
    ["код_ученика", "класс", "тема", "название_темы", "тип_задачи", "время", "автор", "сообщение"],
    rows
      .filter((r) => classById.has(r.user_id))
      .map((r) => {
        const info = taskInfo.get(r.task_id);
        return [
          studentCode(r.user_id),
          classById.get(r.user_id),
          info?.topic?.order_number,
          info?.topic?.title,
          info?.type,
          exportTime.format(new Date(r.created_at)),
          r.role === "user" ? "ученик" : "ИИ",
          r.message,
        ];
      }),
  );
}

// --- Invite codes ------------------------------------------------------------

export async function listInvitesAdmin() {
  await requireAdmin();
  const { data, error } = await createAdminClient()
    .from("invite_codes")
    .select("code, note, created_at, used_at, used_by, users(name, class)")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(`Failed to load invites: ${error.code}`);
  return (data ?? []).map((row) => {
    const student = row.users as unknown as { name: string; class: string } | null;
    return {
      code: row.code as string,
      note: row.note as string,
      createdAt: row.created_at as string,
      usedAt: row.used_at as string | null,
      usedBy: row.used_by as string | null,
      student,
    };
  });
}
