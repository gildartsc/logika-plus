import type { TaskInput, TopicInput } from "./schema.ts";

export type TopicRow = {
  order_number: number;
  title: string;
  description: string;
};

export type TaskRow = {
  topic_id: string;
  type: TaskInput["type"];
  public_text: string;
  ai_context: string;
  grading_criteria: string;
  common_mistakes: string;
  hint_1: string;
  hint_2: string;
  hint_3: string;
};

export function toBulletList(items: string[]): string {
  return items.map((item) => `- ${item}`).join("\n");
}

export function toTopicRow(topic: TopicInput): TopicRow {
  return {
    order_number: topic.order_number,
    title: topic.title,
    description: topic.description,
  };
}

export function toTaskRow(task: TaskInput, topicId: string): TaskRow {
  const [hint1, hint2, hint3] = task.hints;
  return {
    topic_id: topicId,
    type: task.type,
    public_text: task.public_text,
    ai_context: task.ai_context,
    grading_criteria: toBulletList(task.grading_criteria),
    common_mistakes: toBulletList(task.common_mistakes),
    hint_1: hint1,
    hint_2: hint2,
    hint_3: hint3,
  };
}
