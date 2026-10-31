import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  claimInvite: vi.fn(),
  releaseInvite: vi.fn(),
  linkInviteToUser: vi.fn(),
  createUser: vi.fn(),
  signInWithPassword: vi.fn(),
}));

vi.mock("@/lib/invites/store", () => ({
  claimInvite: m.claimInvite,
  releaseInvite: m.releaseInvite,
  linkInviteToUser: m.linkInviteToUser,
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ auth: { admin: { createUser: m.createUser } } }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { signInWithPassword: m.signInWithPassword } }),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

const { signUp } = await import("./actions");

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

const VALID = { inviteCode: "k7m2-qx9p", name: "Аня", className: "9А", email: "anya@example.com", password: "secret123" };

describe("signUp with an invite code", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.claimInvite.mockResolvedValue(true);
    m.createUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    m.signInWithPassword.mockResolvedValue({ error: null });
  });

  it("claims the code, creates a student and signs in", async () => {
    await expect(signUp({}, form(VALID))).rejects.toThrow("REDIRECT:");
    expect(m.claimInvite).toHaveBeenCalledWith("K7M2QX9P");
    // No role in the request: the database trigger makes every new user a student.
    expect(m.createUser).toHaveBeenCalledWith({
      email: "anya@example.com",
      password: "secret123",
      email_confirm: true,
      user_metadata: { name: "Аня", class: "9А" },
    });
    expect(m.linkInviteToUser).toHaveBeenCalledWith("K7M2QX9P", "user-1");
  });

  it("rejects a used or unknown code without creating an account", async () => {
    m.claimInvite.mockResolvedValue(false);
    const result = await signUp({}, form(VALID));
    expect(result.fieldErrors?.inviteCode?.[0]).toMatch(/уже использован/);
    expect(m.createUser).not.toHaveBeenCalled();
  });

  it("rejects a malformed code before touching the database", async () => {
    const result = await signUp({}, form({ ...VALID, inviteCode: "123" }));
    expect(result.fieldErrors?.inviteCode).toBeDefined();
    expect(m.claimInvite).not.toHaveBeenCalled();
  });

  it("gives the code back when the account cannot be created", async () => {
    m.createUser.mockResolvedValue({ data: { user: null }, error: { code: "email_exists" } });
    const result = await signUp({}, form(VALID));
    expect(result.error).toBe("Пользователь с таким e-mail уже зарегистрирован");
    expect(m.releaseInvite).toHaveBeenCalledWith("K7M2QX9P");
    expect(m.linkInviteToUser).not.toHaveBeenCalled();
  });
});
