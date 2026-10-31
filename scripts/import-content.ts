// Imports topics and tasks from a JSON file into Supabase.
// Usage: npm run import:content -- <file.json> [--dry-run]
// Re-running updates existing rows; topics missing from the file are kept,
// so student progress is never deleted by an import.
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { toTaskRow, toTopicRow } from "../src/lib/content/rows.ts";
import { contentFileSchema, type ContentFile } from "../src/lib/content/schema.ts";

function fail(message: string): never {
  console.error(`Ошибка: ${message}`);
  process.exit(1);
}

async function loadContent(path: string): Promise<ContentFile> {
  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    fail(`не удалось прочитать JSON из ${path}: ${(error as Error).message}`);
  }
  const parsed = contentFileSchema.safeParse(raw);
  if (!parsed.success) {
    fail(`файл не прошёл проверку:\n${z.prettifyError(parsed.error)}`);
  }
  return parsed.data;
}

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    fail("нет NEXT_PUBLIC_SUPABASE_URL или SUPABASE_SERVICE_ROLE_KEY в .env.local");
  }
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

async function importContent(content: ContentFile) {
  const supabase = adminClient();

  const { data: topics, error: topicsError } = await supabase
    .from("topics")
    .upsert(content.topics.map(toTopicRow), { onConflict: "order_number" })
    .select("id, order_number");
  if (topicsError || !topics) {
    fail(`не удалось записать темы: ${topicsError?.message}`);
  }

  const topicIds = new Map(topics.map((t) => [t.order_number as number, t.id as string]));
  const taskRows = content.topics.flatMap((topic) => {
    const topicId = topicIds.get(topic.order_number);
    if (!topicId) fail(`не найден id темы ${topic.order_number}`);
    return topic.tasks.map((task) => toTaskRow(task, topicId));
  });

  const { error: tasksError } = await supabase
    .from("tasks")
    .upsert(taskRows, { onConflict: "topic_id,type" });
  if (tasksError) {
    fail(`темы записаны, но задачи нет: ${tasksError.message}. Запустите импорт ещё раз`);
  }

  return { topics: topics.length, tasks: taskRows.length };
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const path = args.find((arg) => !arg.startsWith("--"));
  if (!path) fail("укажите путь к JSON-файлу");

  const content = await loadContent(path);
  const taskCount = content.topics.reduce((sum, topic) => sum + topic.tasks.length, 0);
  if (dryRun) {
    console.log(`Файл в порядке: тем ${content.topics.length}, задач ${taskCount}. В базу ничего не записано.`);
    return;
  }

  const result = await importContent(content);
  console.log(`Готово: записано тем ${result.topics}, задач ${result.tasks}.`);
}

await main();
