import { describe, expect, it } from "vitest";
import { checkAccess, type Profile } from "./access";

const student: Profile = {
  id: "u1",
  name: "Аня",
  role: "student",
  class: "9А",
  total_points: 0,
  is_blocked: false,
};
const admin: Profile = { ...student, id: "a1", role: "admin" };

describe("checkAccess", () => {
  it("rejects guests", () => {
    expect(checkAccess(null, null, "student").status).toBe("unauthenticated");
    expect(checkAccess(null, null, "admin").status).toBe("unauthenticated");
  });

  it("rejects users without a profile", () => {
    expect(checkAccess("u1", null, "student").status).toBe("no_profile");
  });

  it("rejects a profile that belongs to another user", () => {
    expect(checkAccess("u2", student, "student").status).toBe("no_profile");
  });

  it("rejects blocked users everywhere", () => {
    const blocked = { ...student, is_blocked: true };
    expect(checkAccess("u1", blocked, "student").status).toBe("blocked");
    const blockedAdmin = { ...admin, is_blocked: true };
    expect(checkAccess("a1", blockedAdmin, "admin").status).toBe("blocked");
  });

  it("does not let students into admin routes", () => {
    expect(checkAccess("u1", student, "admin").status).toBe("forbidden");
  });

  it("allows students on student routes and admins everywhere", () => {
    expect(checkAccess("u1", student, "student")).toEqual({ status: "ok", profile: student });
    expect(checkAccess("a1", admin, "student").status).toBe("ok");
    expect(checkAccess("a1", admin, "admin").status).toBe("ok");
  });
});
