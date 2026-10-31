import { describe, expect, it } from "vitest";
import { ANSWER_MAX_CHARS } from "@/config/limits";
import { answerSchema } from "./validation";

const taskId = "3f1c1b9e-1b2a-4c3d-9e8f-0a1b2c3d4e5f";

describe("answerSchema", () => {
  it("accepts and trims an answer", () => {
    expect(answerSchema.parse({ taskId, answer: "  мой ответ  " }).answer).toBe("мой ответ");
  });

  it("rejects an empty answer", () => {
    expect(answerSchema.safeParse({ taskId, answer: "   " }).success).toBe(false);
    expect(answerSchema.safeParse({ taskId, answer: null }).success).toBe(false);
  });

  it("rejects an answer over the limit", () => {
    const long = "а".repeat(ANSWER_MAX_CHARS + 1);
    expect(answerSchema.safeParse({ taskId, answer: long }).success).toBe(false);
    const max = "а".repeat(ANSWER_MAX_CHARS);
    expect(answerSchema.safeParse({ taskId, answer: max }).success).toBe(true);
  });

  it("rejects a malformed task id", () => {
    expect(answerSchema.safeParse({ taskId: "1; drop table", answer: "x" }).success).toBe(false);
  });

  it("requires text even when files are attached", () => {
    const files = { taskId, answer: "  ", uploadIds: ["7f3c1c1e-8b1a-4c3e-9a51-2f6a5d1e9b10"] };
    const result = answerSchema.safeParse(files);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toMatch(/Напиши в поле ответа/);
    expect(answerSchema.safeParse({ ...files, answer: "решение на фото" }).success).toBe(true);
  });
});
