import { describe, expect, it } from "vitest";
import { csvCell, studentCode, toCsv } from "./csv";

describe("csvCell", () => {
  it("quotes separators, quotes and line breaks", () => {
    expect(csvCell('он сказал "да"; потом')).toBe('"он сказал ""да""; потом"');
    expect(csvCell("строка 1\nстрока 2")).toBe('"строка 1\nстрока 2"');
  });

  it.each(["=HYPERLINK(\"http://x\")", "+7", "-1", "@SUM(A1)"])("neutralizes a formula: %s", (value) => {
    expect(csvCell(value).replace(/^"/, "")).toMatch(/^'/);
  });

  it("keeps numbers and empty values", () => {
    expect(csvCell(-1)).toBe("-1");
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
  });
});

describe("toCsv", () => {
  it("starts with a BOM and uses ; and CRLF", () => {
    const csv = toCsv(["a", "b"], [["1", "2"]]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv.slice(1)).toBe("a;b\r\n1;2\r\n");
  });
});

describe("studentCode", () => {
  const id = "3f1c1b9e-1b2a-4c3d-9e8f-0a1b2c3d4e5f";

  it("is stable and short", () => {
    expect(studentCode(id)).toBe(studentCode(id));
    expect(studentCode(id)).toMatch(/^S-[0-9a-f]{6}$/);
  });

  it("does not contain the id", () => {
    expect(studentCode(id)).not.toContain(id.slice(0, 6));
  });

  it("differs between students", () => {
    expect(studentCode(id)).not.toBe(studentCode("00000000-0000-4000-8000-000000000000"));
  });
});
