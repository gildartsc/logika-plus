import { describe, expect, it } from "vitest";
import { computeProfileStats, HISTORY_LIMIT } from "./stats";

type Task = Parameters<typeof computeProfileStats>[0][number]["tasks"][number];

function task(overrides: Partial<Task> = {}): Task {
  return {
    type: "critical",
    status: "not_started",
    hints_used: 0,
    ai_messages_count: 0,
    completed_at: null,
    ...overrides,
  };
}

const solved = (type: Task["type"], at: string, extra: Partial<Task> = {}) =>
  task({ type, status: "solved", completed_at: at, ...extra });

describe("computeProfileStats", () => {
  it("is empty for a new student", () => {
    const stats = computeProfileStats([
      { order_number: 1, title: "Т1", status: "current", tasks: [task(), task({ type: "engineering" })] },
    ]);
    expect(stats).toEqual({
      totalTopics: 1,
      completedTopics: 0,
      solvedByType: { critical: 0, engineering: 0 },
      hintsUsed: 0,
      aiMessages: 0,
      history: [],
    });
  });

  it("counts solved tasks by type, hints and mentor messages", () => {
    const stats = computeProfileStats([
      {
        order_number: 1,
        title: "Т1",
        status: "completed",
        tasks: [
          solved("critical", "2026-10-01T10:00:00Z", { hints_used: 2, ai_messages_count: 3 }),
          solved("engineering", "2026-10-02T10:00:00Z", { hints_used: 1 }),
        ],
      },
      {
        order_number: 2,
        title: "Т2",
        status: "current",
        tasks: [solved("critical", "2026-10-03T10:00:00Z"), task({ type: "engineering", hints_used: 3, ai_messages_count: 5 })],
      },
    ]);
    expect(stats.solvedByType).toEqual({ critical: 2, engineering: 1 });
    expect(stats.hintsUsed).toBe(6);
    expect(stats.aiMessages).toBe(8);
    expect(stats.completedTopics).toBe(1);
  });

  it("dates a completed topic by its last solved task and lists newest first", () => {
    const stats = computeProfileStats([
      {
        order_number: 1,
        title: "Т1",
        status: "completed",
        tasks: [solved("critical", "2026-10-01T10:00:00Z"), solved("engineering", "2026-10-05T10:00:00Z")],
      },
      {
        order_number: 2,
        title: "Т2",
        status: "completed",
        tasks: [solved("critical", "2026-10-06T10:00:00Z"), solved("engineering", "2026-10-07T09:00:00Z")],
      },
    ]);
    expect(stats.history).toEqual([
      { order: 2, title: "Т2", completedAt: "2026-10-07T09:00:00Z" },
      { order: 1, title: "Т1", completedAt: "2026-10-05T10:00:00Z" },
    ]);
  });

  it("does not list a topic with only one task solved", () => {
    const stats = computeProfileStats([
      { order_number: 1, title: "Т1", status: "current", tasks: [solved("critical", "2026-10-01T10:00:00Z"), task()] },
    ]);
    expect(stats.history).toEqual([]);
  });

  it(`keeps at most ${HISTORY_LIMIT} entries`, () => {
    const topics = Array.from({ length: 12 }, (_, i) => ({
      order_number: i + 1,
      title: `Т${i + 1}`,
      status: "completed" as const,
      tasks: [solved("critical", `2026-10-${String(i + 1).padStart(2, "0")}T10:00:00Z`)],
    }));
    const stats = computeProfileStats(topics);
    expect(stats.history).toHaveLength(HISTORY_LIMIT);
    expect(stats.history[0].order).toBe(12);
  });
});
