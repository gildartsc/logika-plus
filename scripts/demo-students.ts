// Creates three demo students (test3, test4, test5) and has each of them solve
// every task through the real mentor and grader, so the course can be seen
// from the student and admin side and every task's criteria get checked.
//   test3: correct answer, no AI;
//   test4: one mentor question; every third task starts with a weak answer;
//   test5: two hints, three mentor messages (the last one asks for the
//          answer), every second task starts with a weak answer.
// Answers come from a private JSON file (not in git). The accounts are kept.
// Writes the same rows as the app (chat, submissions, progress, points,
// ai_usage) but skips the per-student daily limits. Spends real tokens.
// Usage: npm run demo:students -- <answers.json> <report.json> [--run] [--max-usd=4]
// Re-running skips tasks a student already answered.
import { randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { AI_LIMITS } from "../src/config/ai.ts";
import { POINTS_TIERS } from "../src/config/points.ts";
import { createAnthropicClient } from "../src/lib/ai/client.ts";
import { computeCostUsd } from "../src/lib/ai/cost.ts";
import { gradeAnswer } from "../src/lib/ai/grader.ts";
import { askMentor } from "../src/lib/ai/mentor.ts";
import type { AiTask, AiUsage, ChatTurn } from "../src/lib/ai/types.ts";

type Answers = { pressure: string[]; tasks: Record<string, { good: string; weak: string; q1: string; q2: string }> };
type Step =
  | { kind: "hint"; number: number }
  | { kind: "chat"; message: string; reply: string | null; failure?: string }
  | { kind: "answer"; quality: "good" | "weak"; text: string; status: string | null; criteriaMet: number[]; feedback: string; points: number };
type TaskRow = AiTask & { id: string; type: "critical" | "engineering"; order_number: number };

const FEEDBACK_PREFIX = "Отзыв на ответ: ";
// Worst case of one call: mentor with full thinking budget, or a grader retry.
const WORST_CALL_USD = 0.02;
const STUDENTS = ["test3", "test4", "test5"] as const;
type Student = (typeof STUDENTS)[number];

const [answersPath, reportPath] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const run = process.argv.includes("--run");
const maxUsd = Number(process.argv.find((a) => a.startsWith("--max-usd="))?.split("=")[1] ?? 4);
if (!answersPath || !reportPath) throw new Error("usage: demo-students.ts <answers.json> <report.json> [--run]");

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// --- Budget -------------------------------------------------------------------

class BudgetStop extends Error {}
let spent = 0;
let reserved = 0;

async function paid<T extends { usages: AiUsage[] }>(call: () => Promise<T>): Promise<T> {
  if (spent + reserved + WORST_CALL_USD > maxUsd) throw new BudgetStop();
  reserved += WORST_CALL_USD;
  try {
    const result = await call();
    spent += result.usages.reduce((sum, usage) => sum + computeCostUsd(usage), 0);
    return result;
  } finally {
    reserved -= WORST_CALL_USD;
  }
}

// --- Database writes, as in src/lib/learn/actions.ts ----------------------------

async function must<T>(promise: PromiseLike<{ data: T; error: { message: string } | null }>, what: string): Promise<T> {
  const { data, error } = await promise;
  if (error) throw new Error(`${what}: ${error.message}`);
  return data;
}

async function recordUsage(userId: string, taskId: string, kind: "chat" | "grading", usages: AiUsage[]) {
  if (usages.length === 0) return;
  await must(
    db.from("ai_usage").insert(
      usages.map((u) => ({
        user_id: userId,
        task_id: taskId,
        kind,
        model: u.model,
        input_tokens: u.input_tokens,
        output_tokens: u.output_tokens,
        cache_read_tokens: u.cache_read_tokens,
        cost_usd: computeCostUsd(u),
      })),
    ),
    "ai_usage",
  );
}

async function addChat(userId: string, taskId: string, turn: ChatTurn) {
  await must(db.from("chat_history").insert({ user_id: userId, task_id: taskId, ...turn }), "chat_history");
}

async function recentTurns(userId: string, taskId: string): Promise<ChatTurn[]> {
  const rows = await must(
    db.from("chat_history").select("role, message").eq("user_id", userId).eq("task_id", taskId)
      .order("created_at", { ascending: false }).limit(AI_LIMITS.historyMessages),
    "read chat",
  );
  return (rows as ChatTurn[]).reverse();
}

type Progress = { status: string; attempts_count: number; hints_used: number; ai_messages_count: number };

// One writer per student and task here, so a plain read-modify-write is enough.
async function bumpProgress(userId: string, taskId: string, change: (p: Progress) => Partial<Progress>) {
  await must(
    db.from("user_progress").upsert({ user_id: userId, task_id: taskId }, { onConflict: "user_id,task_id", ignoreDuplicates: true }),
    "progress insert",
  );
  const row = (await must(
    db.from("user_progress").select("status, attempts_count, hints_used, ai_messages_count")
      .eq("user_id", userId).eq("task_id", taskId).single(),
    "progress read",
  )) as Progress;
  const next = { ...row, ...change(row) };
  await must(db.from("user_progress").update(next).eq("user_id", userId).eq("task_id", taskId), "progress update");
  return next;
}

const inProgress = (p: Progress) => (p.status === "solved" ? "solved" : "in_progress");

async function openHint(userId: string, task: TaskRow, steps: Step[]) {
  const p = await bumpProgress(userId, task.id, (p) => ({ hints_used: Math.min(p.hints_used + 1, 3), status: inProgress(p) }));
  steps.push({ kind: "hint", number: p.hints_used });
}

async function chat(userId: string, task: TaskRow, message: string, steps: Step[]) {
  await addChat(userId, task.id, { role: "user", message });
  const turns = await recentTurns(userId, task.id);
  const result = await paid(async () => {
    const r = await askMentor(client, task, turns);
    return { ...r, usages: r.usage ? [r.usage] : [] };
  });
  await recordUsage(userId, task.id, "chat", result.usages);
  if (!result.ok) {
    steps.push({ kind: "chat", message, reply: null, failure: result.reason });
    return;
  }
  await addChat(userId, task.id, { role: "ai", message: result.text });
  await bumpProgress(userId, task.id, (p) => ({ ai_messages_count: p.ai_messages_count + 1, status: inProgress(p) }));
  steps.push({ kind: "chat", message, reply: result.text });
}

async function answer(userId: string, task: TaskRow, text: string, quality: "good" | "weak", steps: Step[]) {
  const submission = (await must(
    db.from("submissions").insert({ user_id: userId, task_id: task.id, answer_text: text }).select("id").single(),
    "submission",
  )) as { id: string };
  const result = await paid(() => gradeAnswer(client, task, text));
  await recordUsage(userId, task.id, "grading", result.usages);
  const progress = await bumpProgress(userId, task.id, (p) => ({ attempts_count: p.attempts_count + 1, status: inProgress(p) }));
  if (!result.ok) {
    steps.push({ kind: "answer", quality, text, status: null, criteriaMet: [], feedback: `(нет оценки: ${result.reason})`, points: 0 });
    return;
  }
  const { grade } = result;
  await must(
    db.from("submissions").update({ ai_feedback: grade.feedback, ai_status: grade.status, criteria_met: grade.criteriaMet }).eq("id", submission.id),
    "feedback",
  );
  await addChat(userId, task.id, { role: "ai", message: FEEDBACK_PREFIX + grade.feedback });
  let points = 0;
  if (grade.status === "solved") {
    const tier = POINTS_TIERS.find((t) => progress.ai_messages_count <= t.maxAiMessages);
    const awarded = await must(
      db.rpc("award_task_points", { p_user_id: userId, p_task_id: task.id, p_points: tier?.points ?? 0 }),
      "award",
    );
    if (awarded === true) points = tier?.points ?? 0;
  }
  steps.push({ kind: "answer", quality, text, status: grade.status, criteriaMet: grade.criteriaMet, feedback: grade.feedback, points });
}

// --- Students -----------------------------------------------------------------

async function ensureStudent(name: Student): Promise<{ id: string; email: string; password: string | null }> {
  const email = `${name}@example.com`;
  const password = randomBytes(9).toString("base64url");
  const { data, error } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name, class: "9" },
  });
  if (data.user) return { id: data.user.id, email, password };
  const list = await db.auth.admin.listUsers({ perPage: 1000 });
  const existing = list.data.users.find((u) => u.email === email);
  if (!existing) throw new Error(`createUser ${name}: ${error?.message}`);
  return { id: existing.id, email, password: null };
}

async function solve(student: Student, userId: string, task: TaskRow, index: number, answers: Answers) {
  const key = `${task.order_number}${task.type === "critical" ? "C" : "E"}`;
  const a = answers.tasks[key];
  if (!a) throw new Error(`no answers for ${key}`);
  const steps: Step[] = [];
  try {
    if (student === "test3") {
      await answer(userId, task, a.good, "good", steps);
    } else if (student === "test4") {
      await chat(userId, task, a.q1, steps);
      if (index % 3 === 0) await answer(userId, task, a.weak, "weak", steps);
      await answer(userId, task, a.good, "good", steps);
    } else {
      await chat(userId, task, a.q1, steps);
      await openHint(userId, task, steps);
      await openHint(userId, task, steps);
      await chat(userId, task, a.q2, steps);
      if (index % 2 === 0) await answer(userId, task, a.weak, "weak", steps);
      await chat(userId, task, answers.pressure[index % answers.pressure.length], steps);
      await answer(userId, task, a.good, "good", steps);
    }
    return { student, task: key, steps, stopped: false };
  } catch (error) {
    if (error instanceof BudgetStop) return { student, task: key, steps, stopped: true };
    throw error;
  }
}

// --- Main ---------------------------------------------------------------------

const client = createAnthropicClient();

async function main() {
  const answers = JSON.parse(await readFile(answersPath, "utf8")) as Answers;
  const rows = await must(
    db.from("tasks").select("id, type, public_text, ai_context, grading_criteria, common_mistakes, topics!inner(order_number)"),
    "tasks",
  );
  const tasks: TaskRow[] = (rows as unknown as (Omit<TaskRow, "order_number"> & { topics: { order_number: number } })[])
    .map(({ topics, ...t }) => ({ ...t, order_number: topics.order_number }))
    .sort((x, y) => x.order_number - y.order_number || (x.type === "critical" ? -1 : 1));
  const missing = tasks.filter((t) => !answers.tasks[`${t.order_number}${t.type === "critical" ? "C" : "E"}`]);
  console.log(`Задач: ${tasks.length}, без ответов в файле: ${missing.length}. Лимит $${maxUsd}.`);
  if (!run) {
    console.log("Пробный запуск, API не вызывается. Для прогона добавьте --run.");
    return;
  }

  const students = new Map<Student, { id: string; email: string; password: string | null }>();
  for (const name of STUDENTS) students.set(name, await ensureStudent(name));
  for (const [name, s] of students) {
    console.log(`${name}: ${s.email} ${s.password ? `пароль ${s.password}` : "(уже был, пароль прежний)"}`);
  }

  const report: Awaited<ReturnType<typeof solve>>[] = [];
  let stopped = false;
  // Two tasks at a time; the three students work on the same task together,
  // so its system prompt is cached for all of them.
  let next = 0;
  async function worker() {
    while (!stopped && next < tasks.length) {
      const index = next++;
      const task = tasks[index];
      const results = await Promise.all(
        STUDENTS.map(async (name) => {
          const userId = students.get(name)!.id;
          const { count } = await db.from("submissions").select("id", { count: "exact", head: true })
            .eq("user_id", userId).eq("task_id", task.id);
          if (count) return null; // answered in an earlier run
          return solve(name, userId, task, index, answers);
        }),
      );
      for (const r of results) if (r) report.push(r);
      if (results.some((r) => r?.stopped)) stopped = true;
      console.log(`${index + 1}/${tasks.length} тема ${task.order_number} ${task.type}: $${spent.toFixed(3)}`);
      await writeFile(reportPath, JSON.stringify({ spent, report }, null, 1));
    }
  }
  await Promise.all([worker(), worker()]);
  await writeFile(reportPath, JSON.stringify({ spent, report }, null, 1));
  console.log(stopped ? `Остановлено по лимиту: $${spent.toFixed(3)}` : `Готово: $${spent.toFixed(3)}`);
}

await main();
