import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";
import { buildGraderRequest, countGradingTokens, gradeAnswer, parseGrade } from "./grader";

const task = { public_text: "Задача", ai_context: "", grading_criteria: "- А\n- Б\n- В", common_mistakes: "" };
const usage = { input_tokens: 500, output_tokens: 80, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 };

function reply(text: string, stop_reason = "end_turn") {
  return { model: "claude-sonnet-5-5", stop_reason, usage, content: [{ type: "text", text }] };
}

function fakeClient(...responses: unknown[]) {
  const create = vi.fn();
  for (const response of responses) create.mockResolvedValueOnce(response);
  return { client: { beta: { messages: { create } } } as unknown as Anthropic, create };
}

const valid = JSON.stringify({ status: "solved", feedback: "Отлично.", criteria_met: [1, 2] });

describe("buildGraderRequest", () => {
  it("uses Sonnet 5.5 with thinking off, 400 tokens, JSON format and fallback", () => {
    const request = buildGraderRequest(task, "ответ");
    expect(request.model).toBe("claude-sonnet-5-5");
    expect(request.max_tokens).toBe(400);
    expect(request.thinking).toEqual({ type: "between_tools" });
    expect(request.output_config.format).toBeDefined();
    expect(request.fallbacks).toBe("default");
    expect(request.betas).toContain("server-side-fallback-2026-07-01");
    const blocks = request.messages[0].content;
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ type: "text" });
    expect(JSON.stringify(blocks[0])).toContain("<answer>");
  });

  it("puts images and PDFs before the answer and DOCX text inside it", () => {
    const request = buildGraderRequest(task, "", [
      { kind: "image", mime: "image/png", base64: "iVBO" },
      { kind: "pdf", base64: "JVBE" },
      { kind: "docx", name: "работа.docx", text: "Мой разбор" },
    ]);
    const blocks = request.messages[0].content;
    expect(blocks.map((b) => b.type)).toEqual(["image", "document", "text"]);
    expect(blocks[0]).toMatchObject({ source: { type: "base64", media_type: "image/png", data: "iVBO" } });
    expect(blocks[1]).toMatchObject({ source: { type: "base64", media_type: "application/pdf", data: "JVBE" } });
    const text = (blocks[2] as { text: string }).text;
    expect(text).toContain('<attachment name="работа.docx">');
    expect(text).toContain("Мой разбор");
    expect(text).toContain("решение в прикреплённых файлах");
  });

  it("keeps the cached system prompt identical with and without files", () => {
    const plain = buildGraderRequest(task, "ответ");
    const withFiles = buildGraderRequest(task, "ответ", [{ kind: "pdf", base64: "JVBE" }]);
    expect(withFiles.system).toEqual(plain.system);
  });
});

describe("countGradingTokens", () => {
  it("counts the full request including files", async () => {
    const countTokens = vi.fn().mockResolvedValue({ input_tokens: 4321 });
    const client = { beta: { messages: { countTokens } } } as unknown as Anthropic;
    expect(await countGradingTokens(client, task, "ответ", [{ kind: "pdf", base64: "JVBE" }])).toBe(4321);
    expect(countTokens.mock.calls[0][0].messages[0].content[0].type).toBe("document");
  });

  it("returns null when counting fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const countTokens = vi.fn().mockRejectedValue(new Error("down"));
    const client = { beta: { messages: { countTokens } } } as unknown as Anthropic;
    expect(await countGradingTokens(client, task, "ответ", [])).toBeNull();
  });
});

describe("parseGrade", () => {
  it("parses a valid result", () => {
    expect(parseGrade(valid, 3)).toEqual({ status: "solved", feedback: "Отлично.", criteriaMet: [1, 2] });
  });

  it("rejects broken JSON and wrong shapes", () => {
    expect(parseGrade("{not json", 3)).toBeNull();
    expect(parseGrade(JSON.stringify({ status: "great", feedback: "x", criteria_met: [] }), 3)).toBeNull();
    expect(parseGrade(JSON.stringify({ status: "solved", feedback: "  ", criteria_met: [1] }), 3)).toBeNull();
  });

  it("drops out-of-range and duplicate criteria", () => {
    const text = JSON.stringify({ status: "needs_work", feedback: "x", criteria_met: [3, 0, 9, 3, 1] });
    expect(parseGrade(text, 3)?.criteriaMet).toEqual([1, 3]);
  });

  it("does not accept 'solved' with no criteria met", () => {
    const text = JSON.stringify({ status: "solved", feedback: "x", criteria_met: [] });
    expect(parseGrade(text, 3)?.status).toBe("needs_work");
  });
});

describe("gradeAnswer", () => {
  it("returns the grade on the first valid response", async () => {
    const { client, create } = fakeClient(reply(valid));
    const result = await gradeAnswer(client, task, "ответ");
    expect(result).toMatchObject({ ok: true, grade: { status: "solved" } });
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("retries once after invalid JSON and records both usages", async () => {
    const { client, create } = fakeClient(reply("oops"), reply(valid));
    const result = await gradeAnswer(client, task, "ответ");
    expect(result.ok).toBe(true);
    expect(create).toHaveBeenCalledTimes(2);
    expect(result.usages).toHaveLength(2);
  });

  it("retries once after a truncated response", async () => {
    const { client, create } = fakeClient(reply('{"status":"sol', "max_tokens"), reply(valid));
    expect((await gradeAnswer(client, task, "ответ")).ok).toBe(true);
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("gives up after the single retry", async () => {
    const { client, create } = fakeClient(reply("bad"), reply("still bad"));
    expect(await gradeAnswer(client, task, "ответ")).toMatchObject({ ok: false, reason: "invalid_output" });
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("does not retry a refusal", async () => {
    const { client, create } = fakeClient({ ...reply(""), stop_reason: "refusal", content: [] });
    expect(await gradeAnswer(client, task, "ответ")).toMatchObject({ ok: false, reason: "refusal" });
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("reports API errors", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const create = vi.fn().mockRejectedValue(new Error("down"));
    const client = { beta: { messages: { create } } } as unknown as Anthropic;
    expect(await gradeAnswer(client, task, "ответ")).toEqual({ ok: false, reason: "error", usages: [] });
  });
});
