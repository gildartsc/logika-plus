import { describe, expect, it } from "vitest";
import { toBulletList, toTaskRow, toTopicRow } from "./rows";

describe("content rows", () => {
  it("maps a topic", () => {
    expect(
      toTopicRow({ order_number: 2, title: "Тема", description: "Описание", tasks: [] as never }),
    ).toEqual({ order_number: 2, title: "Тема", description: "Описание" });
  });

  it("maps a task with checkpoints as a bullet list and hints as columns", () => {
    const row = toTaskRow(
      {
        type: "engineering",
        public_text: "Условие",
        ai_context: "Контекст",
        grading_criteria: ["Учёл А", "Проверил Б"],
        common_mistakes: ["Ошибка"],
        hints: ["h1", "h2", "h3"],
      },
      "topic-id",
    );
    expect(row).toEqual({
      topic_id: "topic-id",
      type: "engineering",
      public_text: "Условие",
      ai_context: "Контекст",
      grading_criteria: "- Учёл А\n- Проверил Б",
      common_mistakes: "- Ошибка",
      hint_1: "h1",
      hint_2: "h2",
      hint_3: "h3",
    });
  });

  it("returns an empty string for an empty list", () => {
    expect(toBulletList([])).toBe("");
  });
});
