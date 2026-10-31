import { describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ buildAttemptsCsv: vi.fn(), buildChatsCsv: vi.fn() }));
vi.mock("@/lib/admin/queries", () => m);

const attempts = await import("@/app/(app)/admin/export/attempts/route");
const chats = await import("@/app/(app)/admin/export/chats/route");

describe("export routes", () => {
  it("do not respond with data when the role check fails", async () => {
    m.buildAttemptsCsv.mockRejectedValue(new Error("REDIRECT:/learn"));
    m.buildChatsCsv.mockRejectedValue(new Error("REDIRECT:/learn"));
    await expect(attempts.GET()).rejects.toThrow("REDIRECT:/learn");
    await expect(chats.GET()).rejects.toThrow("REDIRECT:/learn");
  });

  it("return a CSV attachment without caching", async () => {
    m.buildAttemptsCsv.mockResolvedValue("﻿a;b\r\n");
    const response = await attempts.GET();
    expect(response.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
    expect(response.headers.get("Content-Disposition")).toMatch(/^attachment; filename="attempts-\d{4}-\d{2}-\d{2}\.csv"$/);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});
