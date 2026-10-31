import { z } from "zod";
import { TOPICS_COUNT } from "@/config/app";
import { taskSchema, type TaskInput } from "@/lib/content/schema";

export const topicFormSchema = z.object({
  order_number: z.coerce
    .number({ error: "Укажите номер темы" })
    .int("Номер темы — целое число")
    .min(1, `Номер темы от 1 до ${TOPICS_COUNT}`)
    .max(TOPICS_COUNT, `Номер темы от 1 до ${TOPICS_COUNT}`),
  title: z.string({ error: "Укажите название" }).trim().min(1, "Укажите название").max(200, "Название не длиннее 200 символов"),
  description: z.string().trim().max(2000, "Описание не длиннее 2000 символов").default(""),
});

export type TopicFormInput = z.infer<typeof topicFormSchema>;

// One item per non-empty line; a leading "- " is optional.
export function linesToList(text: unknown): string[] {
  if (typeof text !== "string") return [];
  return text
    .split("\n")
    .map((line) => line.replace(/^\s*[-*•]\s*/, "").trim())
    .filter((line) => line.length > 0);
}

export function listToLines(text: string): string {
  return linesToList(text).join("\n");
}

function field(formData: FormData, name: string): unknown {
  return formData.get(name) ?? undefined;
}

// The admin form goes through the same schema as the JSON import, so both
// enforce the same rules (criteria required, exactly three hints, no answer field).
export function parseTaskForm(formData: FormData) {
  return taskSchema.safeParse({
    type: field(formData, "type"),
    public_text: field(formData, "public_text"),
    ai_context: field(formData, "ai_context"),
    grading_criteria: linesToList(formData.get("grading_criteria")),
    common_mistakes: linesToList(formData.get("common_mistakes")),
    hints: [field(formData, "hint_1"), field(formData, "hint_2"), field(formData, "hint_3")],
  } satisfies Record<keyof TaskInput, unknown>);
}

export function parseTopicForm(formData: FormData) {
  return topicFormSchema.safeParse({
    order_number: field(formData, "order_number"),
    title: field(formData, "title"),
    description: field(formData, "description") ?? "",
  });
}

// Field name -> first error, for showing next to inputs.
export function firstErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0] === "hints" ? `hint_${Number(issue.path[1]) + 1}` : String(issue.path[0]);
    result[key] ??= issue.message;
  }
  return result;
}
