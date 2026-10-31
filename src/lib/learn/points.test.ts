import { describe, expect, it } from "vitest";
import { pointsForSolve } from "./points";

describe("pointsForSolve", () => {
  it.each([
    [0, 100],
    [2, 100],
    [3, 70],
    [5, 70],
    [6, 40],
    [20, 40],
  ])("%i mentor messages give %i XP", (messages, points) => {
    expect(pointsForSolve(messages)).toBe(points);
  });

  it("treats broken counters safely", () => {
    expect(pointsForSolve(-3)).toBe(100);
    expect(pointsForSolve(2.9)).toBe(100);
  });
});
