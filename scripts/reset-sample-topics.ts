// One-off: deletes the three sample topics before the real course is imported.
// Cascades remove their tasks and all student data on them (progress, chat,
// answers, attachment rows); this script also removes the stored files and
// takes back the points earned on those tasks. Usage:
//   node --env-file=.env.local scripts/reset-sample-topics.ts [--run]
import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import { contentFileSchema } from "../src/lib/content/schema.ts";
import { STORAGE_BUCKET } from "../src/config/files.ts";

const run = process.argv.includes("--run");
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

const samples = contentFileSchema.parse(JSON.parse(await readFile("content/sample-topics.json", "utf8")));
const { data: topics, error } = await db.from("topics").select("id, order_number, title");
if (error || !topics) throw new Error(error?.message);

// Only topics whose number and title both match the sample file.
const targets = topics.filter((t) =>
  samples.topics.some((s) => s.order_number === t.order_number && s.title === t.title),
);
const topicIds = targets.map((t) => t.id);
const { data: tasks } = await db.from("tasks").select("id").in("topic_id", topicIds);
const taskIds = (tasks ?? []).map((t) => t.id);
const { data: progress } = await db.from("user_progress").select("user_id, points_earned").in("task_id", taskIds);
const { data: files } = await db.from("attachments").select("storage_path").in("task_id", taskIds);

const pointsByUser = new Map<string, number>();
for (const p of progress ?? []) pointsByUser.set(p.user_id, (pointsByUser.get(p.user_id) ?? 0) + p.points_earned);

console.log(`Темы к удалению: ${targets.map((t) => `${t.order_number}. ${t.title}`).join("; ") || "нет"}`);
console.log(`Задач: ${taskIds.length}, записей прогресса: ${progress?.length ?? 0}, файлов: ${files?.length ?? 0}, учеников с баллами: ${pointsByUser.size}`);
if (!run || targets.length === 0) {
  console.log(run ? "Удалять нечего." : "Пробный запуск. Для удаления добавьте --run.");
  process.exit(0);
}

const paths = (files ?? []).map((f) => f.storage_path);
if (paths.length > 0) {
  const { error: storageError } = await db.storage.from(STORAGE_BUCKET).remove(paths);
  if (storageError) throw new Error(`storage: ${storageError.message}`);
}
for (const [userId, points] of pointsByUser) {
  if (points === 0) continue;
  const { data: user } = await db.from("users").select("total_points").eq("id", userId).single();
  const total = Math.max(0, (user?.total_points ?? 0) - points);
  const { error: pointsError } = await db.from("users").update({ total_points: total }).eq("id", userId);
  if (pointsError) throw new Error(`points: ${pointsError.message}`);
}
const { error: deleteError } = await db.from("topics").delete().in("id", topicIds);
if (deleteError) throw new Error(`delete: ${deleteError.message}`);
console.log("Готово: тестовые темы удалены.");
