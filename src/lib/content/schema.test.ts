import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { contentFileSchema, type TaskInput, type TopicInput } from "./schema";

function task(type: TaskInput["type"]): TaskInput {
  return {
    type,
    public_text: "Условие задачи",
    ai_context: "Короткий контекст",
    grading_criteria: ["Ученик учёл условие"],
    common_mistakes: [],
    hints: ["Подсказка 1", "Подсказка 2", "Подсказка 3"],
  };
}

function topic(order: number): TopicInput {
  return {
    order_number: order,
    title: `Тема ${order}`,
    description: "",
    tasks: [task("critical"), task("engineering")],
  };
}

describe("contentFileSchema", () => {
  it("accepts the sample content file", () => {
    const raw = JSON.parse(readFileSync("content/sample-topics.json", "utf8"));
    const result = contentFileSchema.safeParse(raw);
    expect(result.success).toBe(true);
    expect(result.data?.topics).toHaveLength(3);
  });

  it("accepts the course file with every topic", () => {
    const raw = JSON.parse(readFileSync("content/course.json", "utf8"));
    const result = contentFileSchema.safeParse(raw);
    expect(result.success).toBe(true);
    expect(result.data?.topics.map((t) => t.order_number)).toEqual(
      Array.from({ length: 34 }, (_, i) => i + 1),
    );
  });

  it("accepts a minimal valid file", () => {
    expect(contentFileSchema.safeParse({ topics: [topic(1), topic(2)] }).success).toBe(true);
  });

  it("rejects duplicate topic numbers", () => {
    const result = contentFileSchema.safeParse({ topics: [topic(1), topic(1)] });
    expect(result.success).toBe(false);
  });

  it.each([0, 35, 1.5])("rejects topic number %s", (order) => {
    expect(contentFileSchema.safeParse({ topics: [topic(order)] }).success).toBe(false);
  });

  it("requires one critical and one engineering task", () => {
    const twoCritical = { ...topic(1), tasks: [task("critical"), task("critical")] };
    expect(contentFileSchema.safeParse({ topics: [twoCritical] }).success).toBe(false);
    const oneTask = { ...topic(1), tasks: [task("critical")] };
    expect(contentFileSchema.safeParse({ topics: [oneTask] }).success).toBe(false);
  });

  it("requires exactly three hints", () => {
    const badTask = { ...task("critical"), hints: ["1", "2"] };
    const bad = { ...topic(1), tasks: [badTask, task("engineering")] };
    expect(contentFileSchema.safeParse({ topics: [bad] }).success).toBe(false);
  });

  it("requires at least one grading criterion", () => {
    const badTask = { ...task("critical"), grading_criteria: [] };
    const bad = { ...topic(1), tasks: [badTask, task("engineering")] };
    expect(contentFileSchema.safeParse({ topics: [bad] }).success).toBe(false);
  });

  it("rejects unknown fields such as a stored answer", () => {
    const withAnswer = { ...task("critical"), correct_answer: "42" };
    const bad = { ...topic(1), tasks: [withAnswer, task("engineering")] };
    expect(contentFileSchema.safeParse({ topics: [bad] }).success).toBe(false);
  });

  it("rejects blank texts", () => {
    const badTask = { ...task("critical"), public_text: "   " };
    const bad = { ...topic(1), tasks: [badTask, task("engineering")] };
    expect(contentFileSchema.safeParse({ topics: [bad] }).success).toBe(false);
  });
});
