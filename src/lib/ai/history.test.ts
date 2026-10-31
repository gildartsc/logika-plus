import { describe, expect, it } from "vitest";
import { toApiMessages } from "./history";
import type { ChatTurn } from "./types";

function turns(n: number): ChatTurn[] {
  return Array.from({ length: n }, (_, i) => ({
    role: i % 2 === 0 ? "user" : "ai",
    message: `m${i}`,
  }));
}

describe("toApiMessages", () => {
  it("maps roles to the API format", () => {
    expect(toApiMessages(turns(2), 8)).toEqual([
      { role: "user", content: "m0" },
      { role: "assistant", content: "m1" },
    ]);
  });

  it("keeps only the last messages of the window", () => {
    const result = toApiMessages(turns(21), 8);
    expect(result).toHaveLength(7); // window starts with an AI turn, which is dropped
    expect(result[0]).toEqual({ role: "user", content: "m14" });
    expect(result.at(-1)).toEqual({ role: "user", content: "m20" });
  });

  it("never starts with an assistant message", () => {
    const result = toApiMessages([{ role: "ai", message: "x" }, { role: "user", message: "y" }], 8);
    expect(result[0].role).toBe("user");
  });

  it("returns nothing without a user message", () => {
    expect(toApiMessages([{ role: "ai", message: "x" }], 8)).toEqual([]);
  });
});
