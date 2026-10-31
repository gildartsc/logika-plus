import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { detectMime, hasMacros, mimeForName, sanitizeFileName } from "./detect";
import { extractDocxText } from "./docx";
import { stripJpegMetadata, stripPngMetadata } from "./metadata";

const fixture = (name: string) => new Uint8Array(readFileSync(`test/fixtures/${name}`));
const bytes = (...values: number[]) => Uint8Array.from(values);
const ascii = (text: string) => Array.from(text, (c) => c.charCodeAt(0));

// --- builders for tiny test images ---

function segment(marker: number, body: number[]): number[] {
  const length = body.length + 2;
  return [0xff, marker, length >> 8, length & 0xff, ...body];
}

// EXIF APP1 with Orientation=6 and a fake GPS marker string inside.
function exifBody(orientation: number): number[] {
  return [
    ...ascii("Exif\0\0"),
    ...[0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00], // little-endian TIFF
    ...[0x02, 0x00], // two entries
    ...[0x12, 0x01, 0x03, 0x00, 0x01, 0x00, 0x00, 0x00, orientation, 0x00, 0x00, 0x00],
    ...[0x25, 0x88, 0x04, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00], // GPS IFD pointer
    ...[0x00, 0x00, 0x00, 0x00],
    ...ascii("GPS 55.7558N 37.6173E"),
  ];
}

function jpeg(orientation = 6): Uint8Array {
  return bytes(
    0xff, 0xd8,
    ...segment(0xe0, ascii("JFIF\0")),
    ...segment(0xe1, exifBody(orientation)),
    ...segment(0xfe, ascii("comment by phone")),
    ...segment(0xdb, [0, 1, 2, 3]),
    0xff, 0xda, 0x00, 0x04, 0x01, 0x02, 0x10, 0x20, 0x30, 0xff, 0xd9,
  );
}

function pngChunk(type: string, data: number[]): number[] {
  const length = data.length;
  return [0, 0, (length >> 8) & 0xff, length & 0xff, ...ascii(type), ...data, 0xaa, 0xbb, 0xcc, 0xdd];
}

function png(): Uint8Array {
  return bytes(
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ...pngChunk("IHDR", Array(13).fill(1)),
    ...pngChunk("tEXt", ascii("Author\0Ivan Petrov")),
    ...pngChunk("eXIf", ascii("GPS")),
    ...pngChunk("IDAT", [9, 9, 9]),
    ...pngChunk("IEND", []),
  );
}

const text = (data: Uint8Array) => Buffer.from(data).toString("latin1");

describe("detectMime", () => {
  it("recognizes allowed files by content", () => {
    expect(detectMime(jpeg())).toBe("image/jpeg");
    expect(detectMime(png())).toBe("image/png");
    expect(detectMime(Uint8Array.from(ascii("%PDF-1.7\n...")))).toBe("application/pdf");
    expect(detectMime(fixture("sample.docx"))).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
  });

  it("rejects other content whatever the name says", () => {
    expect(detectMime(Uint8Array.from(ascii("MZ\x90\x00 program")))).toBeNull(); // an .exe renamed to .jpg
    expect(detectMime(fixture("not-word.zip"))).toBeNull();
    expect(detectMime(Uint8Array.from(ascii("<svg onload=alert(1)>")))).toBeNull();
    expect(detectMime(new Uint8Array())).toBeNull();
  });

  it("finds macros in Word files", () => {
    expect(hasMacros(fixture("macro.docx"))).toBe(true);
    expect(hasMacros(fixture("sample.docx"))).toBe(false);
  });
});

describe("file names", () => {
  it("maps extensions to types", () => {
    expect(mimeForName("Рисунок.JPEG")).toBe("image/jpeg");
    expect(mimeForName("work.docx")).toBe("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    expect(mimeForName("virus.exe")).toBeNull();
    expect(mimeForName("no-extension")).toBeNull();
  });

  it("removes paths and control characters", () => {
    expect(sanitizeFileName("../../etc/pas\u0000swd.png")).toBe("passwd.png");
    expect(sanitizeFileName("C:\\Users\\Ivan\\решение.pdf")).toBe("решение.pdf");
    expect(sanitizeFileName("a".repeat(300) + ".pdf")).toHaveLength(194);
  });
});

describe("stripJpegMetadata", () => {
  it("removes EXIF (including GPS) and comments but keeps the image data", () => {
    const result = stripJpegMetadata(jpeg(6));
    expect(text(result)).not.toContain("GPS");
    expect(text(result)).not.toContain("comment by phone");
    expect(text(result)).toContain("JFIF");
    // Image data from SOS to EOI is unchanged.
    expect(Array.from(result.slice(-11))).toEqual([0xff, 0xda, 0x00, 0x04, 0x01, 0x02, 0x10, 0x20, 0x30, 0xff, 0xd9]);
    expect(detectMime(result)).toBe("image/jpeg");
  });

  it("keeps only the orientation so portrait photos stay upright", () => {
    const result = stripJpegMetadata(jpeg(6));
    const app1 = text(result).indexOf("Exif");
    expect(app1).toBeGreaterThan(0);
    // Big-endian Orientation tag 0x0112 with value 6.
    expect(Array.from(result.slice(app1 + 6 + 10, app1 + 6 + 20))).toEqual([0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, 6]);
  });

  it("drops EXIF completely when the orientation is normal", () => {
    expect(text(stripJpegMetadata(jpeg(1)))).not.toContain("Exif");
  });

  it("leaves broken files untouched instead of corrupting them", () => {
    const broken = bytes(0xff, 0xd8, 0x00, 0x01, 0x02);
    expect(stripJpegMetadata(broken)).toEqual(broken);
    const badSegment = bytes(0xff, 0xd8, 0xff, 0xe1, 0xff, 0xff, 0x00);
    expect(stripJpegMetadata(badSegment)).toBe(badSegment);
  });
});

describe("stripPngMetadata", () => {
  it("removes text and EXIF chunks and keeps the rest", () => {
    const result = stripPngMetadata(png());
    expect(text(result)).not.toContain("Ivan Petrov");
    expect(text(result)).not.toContain("eXIf");
    expect(text(result)).toContain("IHDR");
    expect(text(result)).toContain("IDAT");
    expect(text(result)).toContain("IEND");
    expect(detectMime(result)).toBe("image/png");
  });
});

describe("extractDocxText", () => {
  it("returns the text of a Word document", async () => {
    const result = await extractDocxText(fixture("sample.docx"));
    expect(result).toContain("Факт можно проверить.");
    expect(result).toContain("Мнение — это оценка.");
  });
});
