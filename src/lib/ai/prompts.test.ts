import { describe, expect, it } from "vitest";
import { buildGraderSystem, buildMentorSystem, parseCriteria, wrapAnswer } from "./prompts";

const task = {
  public_text: "Раздели утверждения на факты и мнения.",
  ai_context: "Тема: факты и мнения.",
  grading_criteria: "- Ученик учёл А\n- Ученик проверил Б",
  common_mistakes: "- Путает факт и мнение",
};

describe("mentor system prompt", () => {
  it("contains the task, criteria and the SPEC rules", () => {
    const system = buildMentorSystem(task);
    expect(system).toContain(task.public_text);
    expect(system).toContain("Ученик учёл А");
    expect(system).toContain("Типичные ошибки");
    expect(system).toContain("Не называй готовое решение");
    expect(system).toContain("не больше 4 коротких предложений");
    expect(system).toContain("Вопросительный знак в сообщении ставь только один раз");
    expect(system).toContain("ответ на который совпадает с итоговым ответом задачи");
  });

  it("is byte-identical for the same task, so it can be cached", () => {
    expect(buildMentorSystem({ ...task })).toBe(buildMentorSystem(task));
  });

  it("is built only from task fields", () => {
    // Personal data cannot leak: the function has no access to the student.
    expect(buildMentorSystem.length).toBe(1);
  });

  it("uses a dash for empty optional fields", () => {
    const system = buildMentorSystem({ ...task, ai_context: "", common_mistakes: " " });
    expect(system).toContain("Контекст задачи (только для тебя): —");
  });
});

describe("grader system prompt", () => {
  it("numbers the criteria", () => {
    const system = buildGraderSystem(task);
    expect(system).toContain("1. Ученик учёл А");
    expect(system).toContain("2. Ученик проверил Б");
    expect(system).toContain("<answer>");
  });

  it("does not ask the model to write out its reasoning", () => {
    expect(buildGraderSystem(task)).not.toMatch(/рассуждай вслух|покажи ход рассуждений|step by step/i);
  });
});

describe("parseCriteria", () => {
  it("splits a bullet list", () => {
    expect(parseCriteria("- А\n- Б\n\n- В")).toEqual(["А", "Б", "В"]);
  });

  it("handles text without bullets", () => {
    expect(parseCriteria("А\nБ")).toEqual(["А", "Б"]);
  });
});

describe("wrapAnswer", () => {
  it("wraps the answer in a tag", () => {
    expect(wrapAnswer("ответ")).toBe("<answer>\nответ\n</answer>");
  });
});
