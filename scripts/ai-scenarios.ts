// Manual quality check: how the mentor and the grader answer in ordinary
// learning situations (not bypass attempts). Each scenario states what a good
// reply looks like; a human compares. Spends real tokens.
// Usage: npm run ai:scenarios                      (list, no API calls)
//        npm run ai:scenarios -- --run [--max-usd=0.08] [--only=6,7,8]
// Save the output to a file before reading it; do not re-run to see it again.
import { readFile } from "node:fs/promises";
import { createAnthropicClient } from "../src/lib/ai/client.ts";
import { computeCostUsd } from "../src/lib/ai/cost.ts";
import { gradeAnswer } from "../src/lib/ai/grader.ts";
import { askMentor } from "../src/lib/ai/mentor.ts";
import type { AiTask, AiUsage, ChatTurn } from "../src/lib/ai/types.ts";
import { toTaskRow } from "../src/lib/content/rows.ts";
import { contentFileSchema, type ContentFile } from "../src/lib/content/schema.ts";

type Scenario = {
  id: number;
  target: "mentor" | "grader";
  topic: number;
  task: "critical" | "engineering";
  turns?: ChatTurn[];
  answer?: string;
  expect: string;
};

function findTask(content: ContentFile, topic: number, type: Scenario["task"]): AiTask {
  const found = content.topics.find((t) => t.order_number === topic)?.tasks.find((t) => t.type === type);
  if (!found) throw new Error(`No sample task for topic ${topic} ${type}`);
  return toTaskRow(found, "sample");
}

async function main() {
  const run = process.argv.includes("--run");
  const arg = process.argv.find((a) => a.startsWith("--max-usd="));
  const limit = arg ? Number(arg.split("=")[1]) : 0.08;
  const content = contentFileSchema.parse(JSON.parse(await readFile("content/sample-topics.json", "utf8")));
  const all = (JSON.parse(await readFile("content/ai-scenarios.json", "utf8")) as { scenarios: Scenario[] }).scenarios;
  const onlyArg = process.argv.find((a) => a.startsWith("--only="));
  const only = onlyArg ? new Set(onlyArg.split("=")[1].split(",").map(Number)) : null;
  const scenarios = only ? all.filter((s) => only.has(s.id)) : all;

  if (!run) {
    for (const s of scenarios) console.log(`${s.id}. [${s.target}] тема ${s.topic}, ${s.task}: ${s.expect}`);
    console.log(`\n${scenarios.length} сценариев. Чтобы отправить их в API, запустите с флагом --run.`);
    return;
  }

  const client = createAnthropicClient();
  const usages: AiUsage[] = [];
  const spent = () => usages.reduce((sum, usage) => sum + computeCostUsd(usage), 0);

  for (const s of scenarios) {
    if (spent() >= limit) {
      console.log(`\nОстановлено: потрачено $${spent().toFixed(4)} из лимита $${limit}.`);
      break;
    }
    const task = findTask(content, s.topic, s.task);
    console.log(`\n=== ${s.id}. [${s.target}] тема ${s.topic}, ${s.task}`);
    console.log(`Ожидание: ${s.expect}`);
    if (s.target === "mentor") {
      const turns = s.turns ?? [];
      console.log(`Ученик: ${turns.at(-1)?.message}`);
      const result = await askMentor(client, task, turns);
      if (result.usage) usages.push(result.usage);
      console.log(`Наставник: ${result.ok ? result.text : `(нет ответа: ${result.reason})`}`);
    } else {
      const result = await gradeAnswer(client, task, s.answer ?? "");
      usages.push(...result.usages);
      console.log(
        result.ok
          ? `Проверка: ${result.grade.status}, критерии [${result.grade.criteriaMet.join(", ")}]\n${result.grade.feedback}`
          : `Проверка: (нет оценки: ${result.reason})`,
      );
    }
  }
  console.log(`\nЗапросов: ${usages.length}, стоимость: $${spent().toFixed(4)}`);
}

await main();
