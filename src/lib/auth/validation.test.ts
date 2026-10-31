import { describe, expect, it } from "vitest";
import { loginSchema, registerSchema } from "./validation";

const validRegistration = {
  inviteCode: " k7m2-qx9p ",
  name: "  Аня  ",
  className: "9А",
  email: "  Anya@Example.com ",
  password: "secret123",
};

describe("registerSchema", () => {
  it("accepts valid data and normalizes it", () => {
    const result = registerSchema.parse(validRegistration);
    expect(result).toEqual({
      inviteCode: "K7M2QX9P",
      name: "Аня",
      className: "9А",
      email: "anya@example.com",
      password: "secret123",
    });
  });

  it("rejects a malformed invite code", () => {
    for (const inviteCode of ["", "K7M2-QX9", "K7M2-QX90", "x".repeat(30)]) {
      expect(registerSchema.safeParse({ ...validRegistration, inviteCode }).success).toBe(false);
    }
  });

  it("rejects missing fields with a Russian message", () => {
    const result = registerSchema.safeParse({ ...validRegistration, name: null });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Заполните поле");
  });

  it.each([
    ["name", "А"],
    ["name", "А".repeat(51)],
    ["className", "   "],
    ["className", "1".repeat(11)],
    ["email", "not-an-email"],
    ["password", "short"],
    ["password", "x".repeat(73)],
  ])("rejects invalid %s", (field, value) => {
    const result = registerSchema.safeParse({ ...validRegistration, [field]: value });
    expect(result.success).toBe(false);
  });

  it("ignores extra fields such as role", () => {
    const result = registerSchema.parse({ ...validRegistration, role: "admin" });
    expect(result).not.toHaveProperty("role");
  });
});

describe("loginSchema", () => {
  it("accepts valid credentials", () => {
    expect(loginSchema.safeParse({ email: "a@b.ru", password: "x" }).success).toBe(true);
  });

  it("rejects an empty password", () => {
    expect(loginSchema.safeParse({ email: "a@b.ru", password: "" }).success).toBe(false);
  });
});
