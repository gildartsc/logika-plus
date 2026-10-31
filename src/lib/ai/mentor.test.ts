import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";
import { askMentor, buildMentorRequest } from "./mentor";

const task = { public_text: "Задача", ai_context: "", grading_criteria: "- А", common_mistakes: "" };
const usage = { input_tokens: 100, output_tokens: 20, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 };

function fakeClient(create: (params: unknown) => Promise<unknown>) {
  return { beta: { messages: { create: vi.fn(create) } } } as unknown as Anthropic;
}

describe("buildMentorRequest", () => {
  it("uses Sonnet 5.5 with short reasoning, 1500 tokens and a cached static system prompt", () => {
    const request = buildMentorRequest(task, [{ role: "user", message: "привет" }]);
    expect(request.model).toBe("claude-sonnet-5-5");
    expect(request.max_tokens).toBe(1500);
    expect(request.thinking).toEqual({ type: "adaptive" });
    expect(request.output_config).toEqual({ effort: "medium" });
    expect(request.fallbacks).toBe("default");
    expect(request.system).toHaveLength(1);
    expect(request.system[0].cache_control).toEqual({ type: "ephemeral" });
  });

  it("keeps the system prompt identical across different messages", () => {
    const a = buildMentorRequest(task, [{ role: "user", message: "один" }]);
    const b = buildMentorRequest(task, [{ role: "user", message: "два" }]);
    expect(a.system).toEqual(b.system);
  });
});

describe("askMentor", () => {
  it("returns the text and usage", async () => {
    const client = fakeClient(async () => ({
      model: "claude-sonnet-5-5",
      stop_reason: "end_turn",
      usage,
      content: [{ type: "text", text: " Подумай о том, кто это сказал. " }],
    }));
    const result = await askMentor(client, task, [{ role: "user", message: "?" }]);
    expect(result).toEqual({
      ok: true,
      text: "Подумай о том, кто это сказал.",
      usage: { model: "claude-sonnet-5-5", input_tokens: 100, output_tokens: 20, cache_read_tokens: 0, cache_write_tokens: 0 },
    });
  });

  it("returns only the text, not the hidden reasoning", async () => {
    const client = fakeClient(async () => ({
      model: "claude-sonnet-5-5",
      stop_reason: "end_turn",
      usage,
      content: [
        { type: "thinking", thinking: "", signature: "sig" },
        { type: "text", text: "Умножь 500 на 0,4: получится ли 20?" },
      ],
    }));
    expect(await askMentor(client, task, [{ role: "user", message: "?" }])).toMatchObject({
      ok: true,
      text: "Умножь 500 на 0,4: получится ли 20?",
    });
  });

  it("does not show a reply cut off by the token limit", async () => {
    const client = fakeClient(async () => ({
      model: "claude-sonnet-5-5",
      stop_reason: "max_tokens",
      usage,
      content: [{ type: "text", text: "Ты хорошо нач" }],
    }));
    expect(await askMentor(client, task, [{ role: "user", message: "?" }])).toMatchObject({ ok: false, reason: "invalid_output" });
  });

  it("reports a refusal with its usage", async () => {
    const client = fakeClient(async () => ({ model: "claude-sonnet-5-5", stop_reason: "refusal", usage, content: [] }));
    const result = await askMentor(client, task, [{ role: "user", message: "?" }]);
    expect(result).toMatchObject({ ok: false, reason: "refusal" });
  });

  it("reports API errors without throwing", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const client = fakeClient(async () => {
      throw new Error("network down");
    });
    expect(await askMentor(client, task, [{ role: "user", message: "?" }])).toEqual({
      ok: false,
      reason: "error",
      usage: null,
    });
  });
});
