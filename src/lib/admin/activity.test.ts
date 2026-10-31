import { describe, expect, it } from "vitest";
import { budgetLevel, countActiveSince } from "./activity";

describe("countActiveSince", () => {
  const since = new Date("2026-10-06T21:00:00Z");

  it("counts students active since the moment, ignoring admins", () => {
    const activity = [
      { user_id: "a", last_activity: "2026-10-07T08:00:00Z" },
      { user_id: "b", last_activity: "2026-10-06T20:59:59Z" },
      { user_id: "admin", last_activity: "2026-10-07T09:00:00Z" },
    ];
    expect(countActiveSince(activity, new Set(["a", "b"]), since)).toBe(1);
  });
});

describe("budgetLevel", () => {
  it.each([
    [0, "ok"],
    [23.99, "ok"],
    [24, "warning"],
    [30, "exceeded"],
    [45, "exceeded"],
  ] as const)("$%s of $30 is %s", (spend, level) => {
    expect(budgetLevel(spend, 30)).toBe(level);
  });
});
