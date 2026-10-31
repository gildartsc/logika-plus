import { beforeEach, describe, expect, it, vi } from "vitest";

const FILE = "55555555-5555-4555-8555-555555555555";
const m = vi.hoisted(() => ({ requireUser: vi.fn(), signedFileUrl: vi.fn() }));

vi.mock("@/lib/auth/guards", () => ({ requireUser: m.requireUser }));
vi.mock("@/lib/files/store", () => ({ signedFileUrl: m.signedFileUrl }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));

const { GET } = await import("@/app/(app)/files/[id]/route");
const call = (id: string) => GET(new Request("http://x"), { params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.clearAllMocks();
  m.requireUser.mockResolvedValue({ id: "u1", role: "student" });
});

describe("/files/[id]", () => {
  it("sends guests to login before anything else", async () => {
    m.requireUser.mockRejectedValue(new Error("REDIRECT:/login"));
    await expect(call(FILE)).rejects.toThrow("REDIRECT:/login");
    expect(m.signedFileUrl).not.toHaveBeenCalled();
  });

  it("redirects an allowed viewer to the signed URL", async () => {
    m.signedFileUrl.mockResolvedValue({ url: "https://storage.example/file" });
    await expect(call(FILE)).rejects.toThrow("REDIRECT:https://storage.example/file");
    expect(m.signedFileUrl).toHaveBeenCalledWith(FILE, { id: "u1", role: "student" });
  });

  it("answers not found for someone else's file", async () => {
    m.signedFileUrl.mockResolvedValue(null);
    await expect(call(FILE)).rejects.toThrow("NOT_FOUND");
  });

  it("rejects malformed ids", async () => {
    await expect(call("../secret")).rejects.toThrow("NOT_FOUND");
    expect(m.signedFileUrl).not.toHaveBeenCalled();
  });
});
