import { describe, expect, it } from "vitest";
import { firstErrors, linesToList, listToLines, parseTaskForm, parseTopicForm } from "./forms";

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

const validTask = {
  type: "critical",
  public_text: "Текст",
  ai_context: "Контекст",
  grading_criteria: "- Учёл А\nПроверил Б\n\n",
  common_mistakes: "",
  hint_1: "п1",
  hint_2: "п2",
  hint_3: "п3",
};

describe("lines", () => {
  it("splits lines and strips bullets", () => {
    expect(linesToList("- А\n  Б\n\n• В")).toEqual(["А", "Б", "В"]);
  });

  it("turns a stored bullet list back into lines", () => {
    expect(listToLines("- А\n- Б")).toBe("А\nБ");
  });
});

describe("parseTaskForm", () => {
  it("accepts a valid task", () => {
    const result = parseTaskForm(form(validTask));
    expect(result.success).toBe(true);
    expect(result.data?.grading_criteria).toEqual(["Учёл А", "Проверил Б"]);
  });

  it("requires criteria and every hint", () => {
    const result = parseTaskForm(form({ ...validTask, grading_criteria: " \n ", hint_2: " " }));
    expect(result.success).toBe(false);
    const errors = firstErrors(result.error!);
    expect(errors.grading_criteria).toBeDefined();
    expect(errors.hint_2).toBeDefined();
  });

  it("rejects an unknown task type", () => {
    expect(parseTaskForm(form({ ...validTask, type: "creative" })).success).toBe(false);
  });
});

describe("parseTopicForm", () => {
  it("accepts a topic", () => {
    expect(parseTopicForm(form({ order_number: "5", title: " Тема ", description: "" })).data).toEqual({
      order_number: 5,
      title: "Тема",
      description: "",
    });
  });

  it.each(["0", "35", "1.5", "abc"])("rejects topic number %s", (n) => {
    expect(parseTopicForm(form({ order_number: n, title: "Тема" })).success).toBe(false);
  });
});
