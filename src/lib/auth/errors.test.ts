import { describe, expect, it } from "vitest";
import { GENERIC_AUTH_ERROR, authErrorMessage } from "./errors";

describe("authErrorMessage", () => {
  it("translates known Supabase codes", () => {
    expect(authErrorMessage("invalid_credentials")).toBe("Неверный e-mail или пароль");
  });

  it("falls back to a generic message", () => {
    expect(authErrorMessage(undefined)).toBe(GENERIC_AUTH_ERROR);
    expect(authErrorMessage("something_new")).toBe(GENERIC_AUTH_ERROR);
  });
});
