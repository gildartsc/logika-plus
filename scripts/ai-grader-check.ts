// Regression check of the answer grader: runs labelled answers (expected
// "solved" or "needs_work") through the real grader and reports mismatches.
// Cases are private (they contain correct answers): content/private/.
// Usage: npm run ai:grader -- <cases.json> <report.json> [--run] [--max-usd=0.2]
// Spends real tokens with --run. The console shows only labels and verdicts.
import { readFile, writeFile } from "node:fs/promises";
import { createAnthropicClient } from "../src/lib/ai/client.ts";
import { computeCostUsd } from "../src/lib/ai/cost.ts";
import { gradeAnswer } from "../src/lib/ai/grader.ts";
import type { AiTask } from "../src/lib/ai/types.ts";
import { toTaskRow } from "../src/lib/content/rows.ts";
import { contentFileSchema } from "../src/lib/content/schema.ts";

type Case = { task: string; kind: string; expect: "solved" | "needs_work"; answer: string };
// Worst case of one grading: two attempts of a 400-token verdict.
const WORST_USD = 0.02;

const [casesPath, reportPath] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const run = process.argv.includes("--run");
const maxUsd = Number(process.argv.find((a) => a.startsWith("--max-usd="))?.split("=")[1] ?? 0.2);
if (!casesPath || !reportPath) throw new Error("usage: ai-grader-check.ts <cases.json> <report.json> [--run]");

const course = contentFileSchema.parse(JSON.parse(await readFile("content/course.json", "utf8")));
const tasks = new Map<string, AiTask>();
for (const topic of course.topics) {
  for (const task of topic.tasks) {
    tasks.set(`${topic.order_number}${task.type === "critical" ? "C" : "E"}`, toTaskRow(task, "course"));
  }
}
const cases = (JSON.parse(await readFile(casesPath, "utf8")) as { cases: Case[] }).cases;
const missing = cases.filter((c) => !tasks.has(c.task));
if (missing.length) throw new Error(`unknown tasks: ${missing.map((c) => c.task).join(", ")}`);

console.log(`Ответов: ${cases.length} (должны приниматься: ${cases.filter((c) => c.expect === "solved").length}). Лимит $${maxUsd}.`);
if (!run) {
  console.log("Пробный запуск, API не вызывается. Для прогона добавьте --run.");
  process.exit(0);
}

const client = createAnthropicClient();
let spent = 0;
const results: (Case & { got: string | null; criteriaMet: number[]; feedback: string })[] = [];
for (const c of cases) {
  if (spent + WORST_USD > maxUsd) {
    console.log(`Остановлено по лимиту: $${spent.toFixed(3)}`);
    break;
  }
  const result = await gradeAnswer(client, tasks.get(c.task)!, c.answer);
  spent += result.usages.reduce((sum, usage) => sum + computeCostUsd(usage), 0);
  const got = result.ok ? result.grade.status : null;
  results.push({ ...c, got, criteriaMet: result.ok ? result.grade.criteriaMet : [], feedback: result.ok ? result.grade.feedback : `(нет оценки: ${result.reason})` });
  console.log(`${got === c.expect ? "ok  " : "FAIL"} ${c.task} ${c.kind}: ожидалось ${c.expect}, получено ${got ?? "ошибка"}`);
}
await writeFile(reportPath, JSON.stringify({ spent, results }, null, 1));
const wrongReject = results.filter((r) => r.expect === "solved" && r.got !== "solved").length;
const wrongAccept = results.filter((r) => r.expect === "needs_work" && r.got !== "needs_work").length;
console.log(`\nПроверено ${results.length}. Хороший ответ отклонён: ${wrongReject}. Слабый ответ принят: ${wrongAccept}. Стоимость $${spent.toFixed(3)}.`);
