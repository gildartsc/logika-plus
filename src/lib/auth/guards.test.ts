import { beforeEach, describe, expect, it, vi } from "vitest";

const state: { userId: string | null; row: unknown } = { userId: null, row: null };

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

vi.mock("next/server", () => ({ connection: async () => {} }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getClaims: async () => ({
        data: state.userId ? { claims: { sub: state.userId } } : null,
      }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: state.row }) }),
      }),
    }),
  }),
}));

const { requireAdmin, requireUser } = await import("./guards");

const studentRow = {
  id: "u1",
  name: "Аня",
  role: "student",
  class: "9А",
  total_points: 120,
  is_blocked: false,
};

describe("guards", () => {
  beforeEach(() => {
    state.userId = null;
    state.row = null;
  });

  it("redirects guests to login", async () => {
    await expect(requireUser()).rejects.toThrow("REDIRECT:/login");
    await expect(requireAdmin()).rejects.toThrow("REDIRECT:/login");
  });

  it("returns the profile for a student", async () => {
    state.userId = "u1";
    state.row = studentRow;
    await expect(requireUser()).resolves.toMatchObject({ id: "u1", role: "student" });
  });

  it("keeps students out of the admin panel", async () => {
    state.userId = "u1";
    state.row = studentRow;
    await expect(requireAdmin()).rejects.toThrow("REDIRECT:/learn");
  });

  it("lets admins into the admin panel", async () => {
    state.userId = "a1";
    state.row = { ...studentRow, id: "a1", role: "admin" };
    await expect(requireAdmin()).resolves.toMatchObject({ role: "admin" });
  });

  it("sends blocked users to the blocked page", async () => {
    state.userId = "u1";
    state.row = { ...studentRow, is_blocked: true };
    await expect(requireUser()).rejects.toThrow("REDIRECT:/blocked");
  });

  it("treats a malformed profile as missing", async () => {
    state.userId = "u1";
    state.row = { ...studentRow, role: "superuser" };
    await expect(requireUser()).rejects.toThrow("REDIRECT:/blocked");
  });
});
