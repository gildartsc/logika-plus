import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProgressRow } from "./progress-store";
import { ANSWER_TEXT_REQUIRED } from "./validation";

const TASK_ID = "3f1c1b9e-1b2a-4c3d-9e8f-0a1b2c3d4e5f";
const AI_TASK = { public_text: "Задача", ai_context: "", grading_criteria: "- А", common_mistakes: "" };
const USAGE = { model: "m", input_tokens: 1, output_tokens: 1, cache_read_tokens: 0, cache_write_tokens: 0 };

const m = vi.hoisted(() => ({
  authorizeTask: vi.fn(),
  updateProgress: vi.fn(),
  checkAiLimits: vi.fn(),
  getAiTask: vi.fn(),
  getRecentTurns: vi.fn(),
  addChatMessage: vi.fn(),
  recordUsage: vi.fn(),
  askMentor: vi.fn(),
  gradeAnswer: vi.fn(),
  insertSubmission: vi.fn(),
  updateSubmission: vi.fn(),
  rpc: vi.fn(),
  verifyUploads: vi.fn(),
  attachToSubmission: vi.fn(),
  prepareUploadSlots: vi.fn(),
  countGradingTokens: vi.fn(),
  hintRow: { hint_1: "п1", hint_2: "п2", hint_3: "п3" } as Record<string, string>,
}));

vi.mock("./access", () => ({
  authorizeTask: m.authorizeTask,
  TASK_UNAVAILABLE: "Задача недоступна",
}));
vi.mock("./progress-store", () => ({ updateProgress: m.updateProgress }));
vi.mock("./ai-store", () => ({
  checkAiLimits: m.checkAiLimits,
  getAiTask: m.getAiTask,
  getRecentTurns: m.getRecentTurns,
  addChatMessage: m.addChatMessage,
  recordUsage: m.recordUsage,
}));
vi.mock("@/lib/files/store", () => {
  class FileError extends Error {}
  return {
    FileError,
    verifyUploads: m.verifyUploads,
    attachToSubmission: m.attachToSubmission,
    prepareUploadSlots: m.prepareUploadSlots,
  };
});
vi.mock("@/lib/ai", async () => ({
  askMentor: m.askMentor,
  gradeAnswer: m.gradeAnswer,
  countGradingTokens: m.countGradingTokens,
  redactPersonalData: (await import("@/lib/ai/redact")).redactPersonalData,
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    rpc: m.rpc,
    from: (table: string) => {
      if (table === "submissions") {
        return {
          insert: (row: unknown) => ({ select: () => ({ single: () => m.insertSubmission(row) }) }),
          update: (patch: unknown) => ({ eq: () => m.updateSubmission(patch) }),
        };
      }
      return {
        select: (column: string) => ({
          eq: () => ({ single: async () => ({ data: { [column]: m.hintRow[column] } }) }),
        }),
      };
    },
  }),
}));

const { openHint, prepareUploads, sendMentorMessage, submitAnswer } = await import("./actions");

type Change = (row: ProgressRow) => (Partial<ProgressRow> & { completed_at?: string }) | null;
const ROW: ProgressRow = { status: "not_started", attempts_count: 0, hints_used: 0, ai_messages_count: 0 };

// Runs the action's change function against a given row, like the real store.
function progressFrom(row: ProgressRow) {
  m.updateProgress.mockImplementation(async (_u: string, _t: string, change: Change) => {
    const patch = change(row);
    return { row: { ...row, ...patch }, patch };
  });
}

function lastChange(): Change {
  return m.updateProgress.mock.calls.at(-1)![2] as Change;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  m.authorizeTask.mockResolvedValue({ ok: true, userId: "user-1", taskId: TASK_ID, taskStatus: "in_progress" });
  m.checkAiLimits.mockResolvedValue({ ok: true });
  m.getAiTask.mockResolvedValue(AI_TASK);
  m.getRecentTurns.mockResolvedValue([{ role: "user", message: "вопрос" }]);
  m.insertSubmission.mockResolvedValue({ data: { id: "sub-1" }, error: null });
  m.updateSubmission.mockResolvedValue({ error: null });
  m.rpc.mockResolvedValue({ data: true, error: null });
  m.verifyUploads.mockResolvedValue([]);
  m.attachToSubmission.mockResolvedValue(undefined);
  m.countGradingTokens.mockResolvedValue(1000);
  progressFrom(ROW);
});

describe("openHint", () => {
  it("does nothing for a task the student cannot open", async () => {
    m.authorizeTask.mockResolvedValue({ ok: false, error: "Эта тема пока закрыта" });
    expect(await openHint(TASK_ID)).toEqual({ ok: false, error: "Эта тема пока закрыта" });
    expect(m.updateProgress).not.toHaveBeenCalled();
  });

  it("opens the next hint and marks the task in progress", async () => {
    progressFrom({ ...ROW, hints_used: 1 });
    expect(await openHint(TASK_ID)).toEqual({ ok: true, hint: "п2", hintsUsed: 2 });
    expect(lastChange()({ ...ROW, hints_used: 1 })).toEqual({ hints_used: 2, status: "in_progress" });
  });

  it("refuses a fourth hint", async () => {
    progressFrom({ ...ROW, hints_used: 3 });
    expect(await openHint(TASK_ID)).toEqual({ ok: false, error: "Все подсказки уже открыты" });
  });
});

describe("sendMentorMessage", () => {
  it("rejects an empty or too long message without calling the AI", async () => {
    expect(await sendMentorMessage(TASK_ID, "   ")).toMatchObject({ ok: false });
    expect(await sendMentorMessage(TASK_ID, "я".repeat(1001))).toMatchObject({ ok: false });
    expect(m.askMentor).not.toHaveBeenCalled();
  });

  it("does not call the AI when a limit is reached", async () => {
    m.checkAiLimits.mockResolvedValue({ ok: false, reason: "day", message: "Лимит на сегодня" });
    expect(await sendMentorMessage(TASK_ID, "привет")).toEqual({ ok: false, error: "Лимит на сегодня" });
    expect(m.askMentor).not.toHaveBeenCalled();
    expect(m.addChatMessage).not.toHaveBeenCalled();
  });

  it("does not call the AI for a locked topic", async () => {
    m.authorizeTask.mockResolvedValue({ ok: false, error: "закрыта" });
    expect(await sendMentorMessage(TASK_ID, "привет")).toEqual({ ok: false, error: "закрыта" });
    expect(m.checkAiLimits).not.toHaveBeenCalled();
    expect(m.askMentor).not.toHaveBeenCalled();
  });

  it("saves both messages, records usage and counts the message", async () => {
    m.askMentor.mockResolvedValue({ ok: true, text: "Наводящий вопрос?", usage: USAGE });
    progressFrom({ ...ROW, ai_messages_count: 4 });

    const result = await sendMentorMessage(TASK_ID, "  мой вопрос ");
    expect(result).toEqual({ ok: true, reply: "Наводящий вопрос?", remaining: 15 });
    expect(m.checkAiLimits).toHaveBeenCalledWith("user-1", TASK_ID, "chat");
    expect(m.addChatMessage).toHaveBeenNthCalledWith(1, "user-1", TASK_ID, { role: "user", message: "мой вопрос" });
    expect(m.addChatMessage).toHaveBeenNthCalledWith(2, "user-1", TASK_ID, { role: "ai", message: "Наводящий вопрос?" });
    expect(m.askMentor).toHaveBeenCalledWith(AI_TASK, [{ role: "user", message: "вопрос" }]);
    expect(m.recordUsage).toHaveBeenCalledWith("user-1", TASK_ID, "chat", [USAGE]);
  });

  it("masks a phone number before saving it and before the AI sees it", async () => {
    m.askMentor.mockResolvedValue({ ok: true, text: "Ок", usage: USAGE });
    await sendMentorMessage(TASK_ID, "мой номер 8-900-123-45-67");
    expect(m.addChatMessage).toHaveBeenNthCalledWith(1, "user-1", TASK_ID, {
      role: "user",
      message: "мой номер [скрыто]",
    });
    // The history sent to the AI is read back from the database, which holds the masked text.
    expect(JSON.stringify(m.addChatMessage.mock.calls)).not.toContain("123-45-67");
  });

  it("records usage of a refusal but does not count it as a mentor reply", async () => {
    m.askMentor.mockResolvedValue({ ok: false, reason: "refusal", usage: USAGE });
    const result = await sendMentorMessage(TASK_ID, "привет");
    expect(result.ok).toBe(false);
    expect(m.recordUsage).toHaveBeenCalledWith("user-1", TASK_ID, "chat", [USAGE]);
    expect(m.updateProgress).not.toHaveBeenCalled();
  });
});

describe("submitAnswer", () => {
  it("rejects an empty answer", async () => {
    const result = await submitAnswer(TASK_ID, "   ");
    expect(result).toEqual({ ok: false, error: ANSWER_TEXT_REQUIRED, saved: false });
    expect(m.insertSubmission).not.toHaveBeenCalled();
  });

  it("does not save or grade when a limit is reached", async () => {
    m.checkAiLimits.mockResolvedValue({ ok: false, reason: "budget", message: "Наставник временно недоступен" });
    const result = await submitAnswer(TASK_ID, "ответ");
    expect(result).toEqual({ ok: false, error: "Наставник временно недоступен", saved: false });
    expect(m.insertSubmission).not.toHaveBeenCalled();
    expect(m.gradeAnswer).not.toHaveBeenCalled();
  });

  it("awards points by mentor messages and stores the feedback", async () => {
    m.gradeAnswer.mockResolvedValue({
      ok: true,
      grade: { status: "solved", feedback: "Молодец.", criteriaMet: [1] },
      usages: [USAGE],
    });
    progressFrom({ ...ROW, status: "in_progress", ai_messages_count: 4 });
    const result = await submitAnswer(TASK_ID, "  мой ответ ");

    expect(result).toEqual({ ok: true, status: "solved", feedback: "Отзыв на ответ: Молодец.", pointsAwarded: 70 });
    expect(m.rpc).toHaveBeenCalledWith("award_task_points", { p_user_id: "user-1", p_task_id: TASK_ID, p_points: 70 });
    expect(m.insertSubmission).toHaveBeenCalledWith({ user_id: "user-1", task_id: TASK_ID, answer_text: "мой ответ" });
    expect(m.gradeAnswer).toHaveBeenCalledWith(AI_TASK, "мой ответ", []);
    expect(m.updateSubmission).toHaveBeenCalledWith({ ai_feedback: "Молодец.", ai_status: "solved", criteria_met: [1] });
    expect(m.recordUsage).toHaveBeenCalledWith("user-1", TASK_ID, "grading", [USAGE]);
    expect(m.addChatMessage).toHaveBeenCalledWith("user-1", TASK_ID, { role: "ai", message: "Отзыв на ответ: Молодец." });

    // The status flip to "solved" belongs to the database function.
    expect(lastChange()({ ...ROW, status: "in_progress", attempts_count: 2 })).toEqual({
      attempts_count: 3,
      status: "in_progress",
    });
  });

  it("awards nothing for a repeated correct answer", async () => {
    m.gradeAnswer.mockResolvedValue({ ok: true, grade: { status: "solved", feedback: "Да.", criteriaMet: [1] }, usages: [] });
    m.rpc.mockResolvedValue({ data: false, error: null });
    const result = await submitAnswer(TASK_ID, "ответ");
    expect(result).toMatchObject({ ok: true, status: "solved", pointsAwarded: 0 });
  });

  it("does not award points for needs_work", async () => {
    m.gradeAnswer.mockResolvedValue({ ok: true, grade: { status: "needs_work", feedback: "Нет.", criteriaMet: [] }, usages: [] });
    const result = await submitAnswer(TASK_ID, "ответ");
    expect(result).toMatchObject({ ok: true, status: "needs_work", pointsAwarded: 0 });
    expect(m.rpc).not.toHaveBeenCalled();
  });

  it("reports a failed award clearly", async () => {
    m.gradeAnswer.mockResolvedValue({ ok: true, grade: { status: "solved", feedback: "Да.", criteriaMet: [1] }, usages: [] });
    m.rpc.mockResolvedValue({ data: null, error: { code: "XX000" } });
    const result = await submitAnswer(TASK_ID, "ответ");
    expect(result).toEqual({ ok: false, error: "Решение принято, но результат не сохранился. Отправь ответ ещё раз", saved: true });
  });

  it("masks contact details in the answer before saving and grading", async () => {
    m.gradeAnswer.mockResolvedValue({ ok: true, grade: { status: "needs_work", feedback: "x", criteriaMet: [] }, usages: [] });
    await submitAnswer(TASK_ID, "ответ, пиши мне на a@b.ru");
    expect(m.insertSubmission).toHaveBeenCalledWith({ user_id: "user-1", task_id: TASK_ID, answer_text: "ответ, пиши мне на [скрыто]" });
    expect(m.gradeAnswer).toHaveBeenCalledWith(AI_TASK, "ответ, пиши мне на [скрыто]", []);
  });

  it("keeps a solved task solved after a weaker answer, without a new completion date", async () => {
    m.gradeAnswer.mockResolvedValue({
      ok: true,
      grade: { status: "needs_work", feedback: "Доработай.", criteriaMet: [] },
      usages: [USAGE],
    });
    await submitAnswer(TASK_ID, "ответ");
    const patch = lastChange()({ ...ROW, status: "solved", attempts_count: 1 });
    expect(patch).toEqual({ attempts_count: 2, status: "solved" });
    expect(m.rpc).not.toHaveBeenCalled();
  });

  it("keeps the answer when grading fails and still records usage", async () => {
    m.gradeAnswer.mockResolvedValue({ ok: false, reason: "invalid_output", usages: [USAGE, USAGE] });
    const result = await submitAnswer(TASK_ID, "ответ");
    expect(result).toMatchObject({ ok: false, saved: true });
    expect(m.recordUsage).toHaveBeenCalledWith("user-1", TASK_ID, "grading", [USAGE, USAGE]);
    expect(lastChange()(ROW)).toEqual({ attempts_count: 1, status: "in_progress" });
  });

  it("reports a save error", async () => {
    m.insertSubmission.mockResolvedValue({ data: null, error: { code: "XX000" } });
    const result = await submitAnswer(TASK_ID, "ответ");
    expect(result).toEqual({ ok: false, error: "Не получилось сохранить. Попробуйте ещё раз", saved: false });
    expect(m.gradeAnswer).not.toHaveBeenCalled();
  });
});

const FILE_ID = "6f1c1b9e-1b2a-4c3d-9e8f-0a1b2c3d4e5f";
const IMAGE = { id: FILE_ID, mime: "image/png", size: 10, grader: { kind: "image", mime: "image/png", base64: "iVBO" } };

describe("submitAnswer with files", () => {
  it("rejects files without text before checking or saving them", async () => {
    const result = await submitAnswer(TASK_ID, "  ", [FILE_ID]);
    expect(result).toEqual({ ok: false, error: ANSWER_TEXT_REQUIRED, saved: false });
    expect(m.verifyUploads).not.toHaveBeenCalled();
    expect(m.insertSubmission).not.toHaveBeenCalled();
  });

  it("sends the text and the files to the grader", async () => {
    m.verifyUploads.mockResolvedValue([IMAGE]);
    m.gradeAnswer.mockResolvedValue({ ok: true, grade: { status: "needs_work", feedback: "x", criteriaMet: [] }, usages: [] });
    const result = await submitAnswer(TASK_ID, "решение на фото", [FILE_ID]);
    expect(result.ok).toBe(true);
    expect(m.verifyUploads).toHaveBeenCalledWith("user-1", TASK_ID, [FILE_ID]);
    expect(m.attachToSubmission).toHaveBeenCalledWith([IMAGE], "sub-1");
    expect(m.gradeAnswer).toHaveBeenCalledWith(AI_TASK, "решение на фото", [IMAGE.grader]);
  });

  it("rejects files over the token ceiling before saving anything", async () => {
    m.verifyUploads.mockResolvedValue([IMAGE]);
    m.countGradingTokens.mockResolvedValue(25_001);
    const result = await submitAnswer(TASK_ID, "ответ", [FILE_ID]);
    expect(result).toMatchObject({ ok: false, saved: false });
    expect(result.ok ? "" : result.error).toMatch(/слишком большие/);
    expect(m.insertSubmission).not.toHaveBeenCalled();
    expect(m.gradeAnswer).not.toHaveBeenCalled();
  });

  it("shows the file check message and saves nothing", async () => {
    const { FileError } = await import("@/lib/files/store");
    m.verifyUploads.mockRejectedValue(new FileError("Файл «x.jpg» не похож на JPG, PNG, PDF, DOCX"));
    const result = await submitAnswer(TASK_ID, "ответ", [FILE_ID]);
    expect(result).toEqual({ ok: false, error: "Файл «x.jpg» не похож на JPG, PNG, PDF, DOCX", saved: false });
    expect(m.insertSubmission).not.toHaveBeenCalled();
  });

  it("does not count tokens when there are no files", async () => {
    m.gradeAnswer.mockResolvedValue({ ok: true, grade: { status: "needs_work", feedback: "x", criteriaMet: [] }, usages: [] });
    await submitAnswer(TASK_ID, "ответ");
    expect(m.countGradingTokens).not.toHaveBeenCalled();
  });

  it("rejects malformed and too many file ids", async () => {
    expect(await submitAnswer(TASK_ID, "ответ", ["../etc"])).toMatchObject({ ok: false, saved: false });
    expect(await submitAnswer(TASK_ID, "ответ", [FILE_ID, FILE_ID, FILE_ID, FILE_ID])).toMatchObject({ ok: false });
    expect(m.verifyUploads).not.toHaveBeenCalled();
  });
});

describe("prepareUploads", () => {
  it("issues upload slots for an open task", async () => {
    m.prepareUploadSlots.mockResolvedValue([{ id: FILE_ID, path: "user-1/a.png", token: "t", name: "a.png" }]);
    const result = await prepareUploads(TASK_ID, [{ name: "a.png", size: 100 }]);
    expect(result).toMatchObject({ ok: true });
    expect(m.prepareUploadSlots).toHaveBeenCalledWith("user-1", TASK_ID, [{ name: "a.png", size: 100 }]);
  });

  it.each([
    [[{ name: "virus.exe", size: 100 }], /можно только/],
    [[{ name: "big.pdf", size: 6 * 1024 * 1024 }], /больше 5 МБ/],
    [[{ name: "a.png", size: 1 }, { name: "b.png", size: 1 }, { name: "c.png", size: 1 }, { name: "d.png", size: 1 }], /не больше 3/],
  ])("rejects a bad request without touching storage", async (files, message) => {
    const result = await prepareUploads(TASK_ID, files);
    expect(result.ok).toBe(false);
    expect(result.ok ? "" : result.error).toMatch(message);
    expect(m.prepareUploadSlots).not.toHaveBeenCalled();
  });

  it("refuses uploads for a locked topic", async () => {
    m.authorizeTask.mockResolvedValue({ ok: false, error: "закрыта" });
    expect(await prepareUploads(TASK_ID, [{ name: "a.png", size: 1 }])).toEqual({ ok: false, error: "закрыта" });
    expect(m.prepareUploadSlots).not.toHaveBeenCalled();
  });
});
