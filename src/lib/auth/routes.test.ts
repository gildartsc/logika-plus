import { describe, expect, it } from "vitest";
import { getAuthRedirect } from "./routes";

describe("getAuthRedirect", () => {
  it.each(["/learn", "/profile", "/admin", "/admin/topics", "/about", "/contacts", "/files/abc"])(
    "sends guests from %s to login",
    (path) => {
      expect(getAuthRedirect(path, false)).toBe("/login");
    },
  );

  it.each(["/", "/login", "/register", "/blocked"])("lets guests open %s", (path) => {
    expect(getAuthRedirect(path, false)).toBeNull();
  });

  it.each(["/login", "/register"])("sends signed-in users from %s to /learn", (path) => {
    expect(getAuthRedirect(path, true)).toBe("/learn");
  });

  it("lets signed-in users open protected pages", () => {
    expect(getAuthRedirect("/learn", true)).toBeNull();
    expect(getAuthRedirect("/admin", true)).toBeNull();
  });

  it("matches whole path segments only", () => {
    expect(getAuthRedirect("/learnmore", false)).toBeNull();
    expect(getAuthRedirect("/administrator", false)).toBeNull();
  });
});
