import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProgressRow } from "./progress-store";

// Minimal fake of the Supabase query builder for user_progress.
const db = vi.hoisted(() => ({
  row: { status: "not_started", attempts_count: 0, hints_used: 0, ai_messages_count: 0 } as ProgressRow,
  // Simulates another request changing the row right before our update.
  concurrentChanges: 0,
  updates: 0,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => {
      const filters: Record<string, unknown> = {};
      let patch: Partial<ProgressRow> | null = null;
      const builder = {
        upsert: async () => ({ error: null }),
        update(p: Partial<ProgressRow>) {
          patch = p;
          return builder;
        },
        eq(column: string, value: unknown) {
          filters[column] = value;
          return builder;
        },
        select() {
          if (!patch) return builder;
          if (db.concurrentChanges > 0) {
            db.concurrentChanges -= 1;
            db.row = { ...db.row, hints_used: db.row.hints_used + 1 };
          }
          const matches = (["status", "attempts_count", "hints_used"] as const).every(
            (key) => filters[key] === db.row[key],
          );
          if (matches) {
            db.row = { ...db.row, ...patch };
            db.updates += 1;
          }
          return Promise.resolve({ data: matches ? [db.row] : [], error: null });
        },
        single: async () => ({ data: { ...db.row }, error: null }),
      };
      return builder;
    },
  }),
}));

const { updateProgress } = await import("./progress-store");

beforeEach(() => {
  db.row = { status: "not_started", attempts_count: 0, hints_used: 0, ai_messages_count: 0 };
  db.concurrentChanges = 0;
  db.updates = 0;
});

describe("updateProgress", () => {
  it("applies the change", async () => {
    const result = await updateProgress("u", "t", (row) => ({ hints_used: row.hints_used + 1 }));
    expect(result.row.hints_used).toBe(1);
    expect(db.updates).toBe(1);
  });

  it("does not write when the change returns null", async () => {
    const result = await updateProgress("u", "t", () => null);
    expect(result.patch).toBeNull();
    expect(db.updates).toBe(0);
  });

  it("re-reads and recomputes after a concurrent change", async () => {
    db.concurrentChanges = 1;
    const result = await updateProgress("u", "t", (row) => ({ hints_used: row.hints_used + 1 }));
    // The other request opened hint 1, so ours must become hint 2, not hint 1 again.
    expect(result.row.hints_used).toBe(2);
  });

  it("gives up after repeated conflicts", async () => {
    db.concurrentChanges = 10;
    await expect(
      updateProgress("u", "t", (row) => ({ hints_used: row.hints_used + 1 })),
    ).rejects.toThrow("conflict");
  });
});
