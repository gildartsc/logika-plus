import { describe, expect, it } from "vitest";
import { computeCostUsd } from "./cost";

const base = { input_tokens: 0, output_tokens: 0, cache_read_tokens: 0, cache_write_tokens: 0 };

describe("computeCostUsd", () => {
  it("prices Haiku 4.5", () => {
    // 3000 input * $1/M + 400 output * $5/M = 0.003 + 0.002
    expect(computeCostUsd({ ...base, model: "claude-haiku-4-5", input_tokens: 3000, output_tokens: 400 })).toBeCloseTo(0.005, 6);
  });

  it("prices cache reads and writes", () => {
    const cost = computeCostUsd({
      ...base,
      model: "claude-sonnet-5-5",
      cache_read_tokens: 1_000_000,
      cache_write_tokens: 1_000_000,
    });
    expect(cost).toBeCloseTo(0.2 + 2.5, 6);
  });

  it("charges unknown models at the highest known price", () => {
    const unknown = computeCostUsd({ ...base, model: "claude-new", input_tokens: 1_000_000 });
    expect(unknown).toBe(2);
  });
});
