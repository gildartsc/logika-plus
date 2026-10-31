import { describe, expect, it } from "vitest";
import { nextHintNumber, openedHints } from "./hints";

const task = { hint_1: "один", hint_2: "два", hint_3: "три" };

describe("hints", () => {
  it("opens hints in order", () => {
    expect(nextHintNumber(0)).toBe(1);
    expect(nextHintNumber(1)).toBe(2);
    expect(nextHintNumber(2)).toBe(3);
  });

  it("never opens a fourth hint", () => {
    expect(nextHintNumber(3)).toBeNull();
    expect(nextHintNumber(10)).toBeNull();
  });

  it("returns only the opened hints", () => {
    expect(openedHints(task, 0)).toEqual([]);
    expect(openedHints(task, 2)).toEqual(["один", "два"]);
    expect(openedHints(task, 3)).toEqual(["один", "два", "три"]);
  });

  it("clamps broken counters", () => {
    expect(openedHints(task, -1)).toEqual([]);
    expect(openedHints(task, 7)).toHaveLength(3);
  });
});
