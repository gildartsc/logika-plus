import { describe, expect, it } from "vitest";
import { addPickedFiles } from "./pick";

const f = (name: string) => ({ name });

describe("addPickedFiles", () => {
  it("adds allowed files", () => {
    expect(addPickedFiles([], [f("a.jpg"), f("b.PDF")])).toEqual({ files: [f("a.jpg"), f("b.PDF")], error: null });
  });

  it("keeps files already chosen", () => {
    expect(addPickedFiles([f("a.jpg")], [f("b.docx")]).files).toEqual([f("a.jpg"), f("b.docx")]);
  });

  it("leaves out other types and says why", () => {
    const result = addPickedFiles([], [f("IMG_0001.HEIC"), f("a.png")]);
    expect(result.files).toEqual([f("a.png")]);
    expect(result.error).toMatch(/IMG_0001\.HEIC.*можно только JPG, PNG, PDF, DOCX/);
  });

  it("never goes over the limit", () => {
    const result = addPickedFiles([f("a.jpg"), f("b.jpg")], [f("c.jpg"), f("d.jpg")]);
    expect(result.files).toHaveLength(3);
    expect(result.error).toMatch(/не больше 3/);
  });
});
