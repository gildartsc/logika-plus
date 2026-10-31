import { describe, expect, it } from "vitest";
import { formatInviteCode, isInviteCode, normalizeInviteCode } from "./code";
import { generateInviteCode } from "./generate";

describe("invite codes", () => {
  it("generates valid, distinct codes", () => {
    const codes = new Set(Array.from({ length: 200 }, generateInviteCode));
    expect(codes.size).toBe(200);
    for (const code of codes) expect(isInviteCode(code)).toBe(true);
  });

  it("accepts the printed form typed carelessly", () => {
    expect(normalizeInviteCode(" abcd-efgh ")).toBe("ABCDEFGH");
    expect(isInviteCode(normalizeInviteCode("k7m2 qx9p"))).toBe(true);
    expect(formatInviteCode("K7M2QX9P")).toBe("K7M2-QX9P");
  });

  it("rejects look-alike characters and wrong lengths", () => {
    expect(isInviteCode("ABCDEFG0")).toBe(false);
    expect(isInviteCode("ABCDEFGI")).toBe(false);
    expect(isInviteCode("ABCDEFG")).toBe(false);
    expect(isInviteCode("ABCD'; --")).toBe(false);
  });
});
