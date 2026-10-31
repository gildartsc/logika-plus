// Manual check: sends bypass attempts to the mentor and the grader and
// prints the replies for a human to review. Spends real tokens.
// Usage: npm run ai:bypass                       (list attempts, no API calls)
//        npm run ai:bypass -- --run [--max-usd=0.12]
//        add --mentor or --grader to run only those attempts
// Save the output to a file before reading it; do not re-run to see it again.
import { readFile } from "node:fs/promises";
import { createAnthropicClient } from "../src/lib/ai/client.ts";
import { computeCostUsd } from "../src/lib/ai/cost.ts";
import { gradeAnswer } from "../src/lib/ai/grader.ts";
import { askMentor } from "../src/lib/ai/mentor.ts";
import { redactPersonalData } from "../src/lib/ai/redact.ts";
import type { AiTask, AiUsage } from "../src/lib/ai/types.ts";
import { toTaskRow } from "../src/lib/content/rows.ts";
import { contentFileSchema } from "../src/lib/content/schema.ts";
import { loadAttachment } from "./lib/attachments.ts";

type Attempt = { id: number; target: "mentor" | "grader"; text: string; files?: string[]; note?: string };

async function loadTask(): Promise<AiTask> {
  const content = contentFileSchema.parse(JSON.parse(await readFile("content/sample-topics.json", "utf8")));
  return toTaskRow(content.topics[0].tasks[0], "sample");
}

function maxUsd(): number {
  const arg = process.argv.find((a) => a.startsWith("--max-usd="));
  return arg ? Number(arg.split("=")[1]) : 0.15;
}

async function main() {
  const run = process.argv.includes("--run");
  const { attempts } = JSON.parse(await readFile("content/ai-bypass-attempts.json", "utf8")) as { attempts: Attempt[] };
  const only = process.argv.includes("--mentor") ? "mentor" : process.argv.includes("--grader") ? "grader" : null;
  const selected = only ? attempts.filter((a) => a.target === only) : attempts;
  const task = await loadTask();

  if (!run) {
    for (const a of selected) console.log(`${a.id}. [${a.target}] ${a.text}${a.files ? ` + ${a.files.join(", ")}` : ""}`);
    console.log(`\n${selected.length} попыток. Чтобы отправить их в API, запустите с флагом --run.`);
    return;
  }

  const client = createAnthropicClient();
  const limit = maxUsd();
  const usages: AiUsage[] = [];
  const spent = () => usages.reduce((sum, usage) => sum + computeCostUsd(usage), 0);

  for (const attempt of selected) {
    if (spent() >= limit) {
      console.log(`\nОстановлено: потрачено $${spent().toFixed(4)} из лимита $${limit}.`);
      break;
    }
    console.log(`\n=== ${attempt.id}. [${attempt.target}] ${attempt.text}${attempt.note ? `  (${attempt.note})` : ""}`);
    // Same masking as the server actions apply.
    const text = redactPersonalData(attempt.text);
    if (attempt.target === "mentor") {
      const result = await askMentor(client, task, [{ role: "user", message: text }]);
      if (result.usage) usages.push(result.usage);
      console.log(result.ok ? result.text : `(нет ответа: ${result.reason})`);
    } else {
      const files = await Promise.all((attempt.files ?? []).map(loadAttachment));
      const result = await gradeAnswer(client, task, text, files);
      usages.push(...result.usages);
      console.log(
        result.ok
          ? `status: ${result.grade.status}, критерии: [${result.grade.criteriaMet.join(", ")}]\n${result.grade.feedback}`
          : `(нет оценки: ${result.reason})`,
      );
    }
  }

  const cacheRead = usages.reduce((sum, usage) => sum + usage.cache_read_tokens, 0);
  console.log(`\nЗапросов: ${usages.length}, стоимость: $${spent().toFixed(4)}, токенов из кэша: ${cacheRead}`);
  console.log("Проверьте вручную: наставник не выдал решение и критерии, проверка не поставила solved ни на одной попытке.");
}

await main();
