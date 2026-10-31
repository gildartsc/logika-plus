import { describe, expect, it } from "vitest";
import { checkLimits, startOfDay, startOfMonth, type LimitCounts } from "./limits";

const fine: LimitCounts = { monthSpendUsd: 0, requestsLastMinute: 0, requestsToday: 0, taskMessages: 0 };

describe("checkLimits", () => {
  it("allows requests under every limit", () => {
    expect(checkLimits({ monthSpendUsd: 29.99, requestsLastMinute: 4, requestsToday: 39, taskMessages: 19 }, "chat")).toEqual({ ok: true });
  });

  it("disables the AI when the monthly budget is reached", () => {
    expect(checkLimits({ ...fine, monthSpendUsd: 30 }, "chat")).toMatchObject({ ok: false, reason: "budget" });
    expect(checkLimits({ ...fine, monthSpendUsd: 31 }, "grading")).toMatchObject({ ok: false, reason: "budget" });
  });

  it("limits 5 requests per minute", () => {
    expect(checkLimits({ ...fine, requestsLastMinute: 5 }, "chat")).toMatchObject({ reason: "minute" });
  });

  it("limits 40 requests per day", () => {
    expect(checkLimits({ ...fine, requestsToday: 40 }, "grading")).toMatchObject({ reason: "day" });
  });

  it("limits 20 chat messages per task, but not answer checks", () => {
    expect(checkLimits({ ...fine, taskMessages: 20 }, "chat")).toMatchObject({ reason: "task" });
    expect(checkLimits({ ...fine, taskMessages: 20 }, "grading")).toEqual({ ok: true });
  });

  it("reports the budget first when several limits are hit", () => {
    expect(checkLimits({ monthSpendUsd: 50, requestsLastMinute: 9, requestsToday: 99, taskMessages: 99 }, "chat")).toMatchObject({ reason: "budget" });
  });
});

describe("day and month boundaries in Moscow time (UTC+3)", () => {
  it("starts the day at Moscow midnight", () => {
    // 23:30 in Moscow on Oct 7 -> the day started at 21:00 UTC on Oct 6.
    expect(startOfDay(new Date("2026-10-07T20:30:00Z"), "Europe/Moscow").toISOString()).toBe("2026-10-06T21:00:00.000Z");
    // 00:30 in Moscow on Oct 8 -> a new day.
    expect(startOfDay(new Date("2026-10-07T21:30:00Z"), "Europe/Moscow").toISOString()).toBe("2026-10-07T21:00:00.000Z");
  });

  it("starts the month at Moscow midnight of the 1st", () => {
    expect(startOfMonth(new Date("2026-10-15T12:00:00Z"), "Europe/Moscow").toISOString()).toBe("2026-09-30T21:00:00.000Z");
    // 01:00 Moscow on Nov 1 is still 31 Oct in UTC, but already November locally.
    expect(startOfMonth(new Date("2026-10-31T22:00:00Z"), "Europe/Moscow").toISOString()).toBe("2026-10-31T21:00:00.000Z");
  });

  it("works for a zone with daylight saving time", () => {
    // Berlin is UTC+2 in summer.
    expect(startOfDay(new Date("2026-07-01T12:00:00Z"), "Europe/Berlin").toISOString()).toBe("2026-06-30T22:00:00.000Z");
  });
});
