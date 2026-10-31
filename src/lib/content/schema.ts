// Imports use explicit .ts extensions so scripts can run on plain Node.
import { z } from "zod";
import { TOPICS_COUNT } from "../../config/app.ts";

function text(max: number) {
  return z.string().trim().min(1, "Не может быть пустым").max(max, `Не длиннее ${max} символов`);
}

// Criteria are checkpoints ("the student checked X"), never a ready answer.
const checkpoints = z.array(text(400)).min(1).max(12);

export const taskSchema = z.strictObject({
  type: z.enum(["critical", "engineering"]),
  public_text: text(10000),
  ai_context: text(1500),
  grading_criteria: checkpoints,
  common_mistakes: z.array(text(400)).max(12),
  hints: z.tuple([text(1000), text(1000), text(1000)]),
});

export const topicSchema = z
  .strictObject({
    order_number: z.number().int().min(1).max(TOPICS_COUNT),
    title: text(200),
    description: z.string().trim().max(2000),
    tasks: z.array(taskSchema).length(2, "В теме должно быть ровно две задачи"),
  })
  .refine(
    (topic) => new Set(topic.tasks.map((task) => task.type)).size === 2,
    { message: "Нужна одна критическая и одна инженерная задача", path: ["tasks"] },
  );

export const contentFileSchema = z
  .strictObject({ topics: z.array(topicSchema).min(1).max(TOPICS_COUNT) })
  .superRefine((file, ctx) => {
    const seen = new Set<number>();
    file.topics.forEach((topic, index) => {
      if (seen.has(topic.order_number)) {
        ctx.addIssue({
          code: "custom",
          message: `Номер темы ${topic.order_number} повторяется`,
          path: ["topics", index, "order_number"],
        });
      }
      seen.add(topic.order_number);
    });
  });

export type TaskInput = z.infer<typeof taskSchema>;
export type TopicInput = z.infer<typeof topicSchema>;
export type ContentFile = z.infer<typeof contentFileSchema>;
