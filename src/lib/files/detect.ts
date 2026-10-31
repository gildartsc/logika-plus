import { FILE_TYPES, type FileMime } from "@/config/files";

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
  return signature.every((byte, i) => bytes[i] === byte);
}

function contains(bytes: Uint8Array, text: string): boolean {
  return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).includes(text, 0, "latin1");
}

// The file type is decided by content, never by the name or the browser.
// A DOCX is a ZIP that contains word/document.xml; ZIP stores entry names
// uncompressed, so they can be found in the raw bytes.
export function detectMime(bytes: Uint8Array): FileMime | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return "application/pdf"; // %PDF-
  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]) && contains(bytes, "word/document.xml")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  return null;
}

// Macro-enabled Word files keep their code in vbaProject.bin.
export function hasMacros(bytes: Uint8Array): boolean {
  return contains(bytes, "vbaProject.bin");
}

export function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
}

export function mimeForName(name: string): FileMime | null {
  const ext = extensionOf(name);
  for (const [mime, info] of Object.entries(FILE_TYPES)) {
    if ((info.extensions as readonly string[]).includes(ext)) return mime as FileMime;
  }
  return null;
}

// Keeps a readable name for display; never used as a storage path.
export function sanitizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const clean = base.replace(/[\u0000-\u001f\u007f<>:"|?*]/g, "").trim();
  if (clean.length <= 200) return clean || "file";
  const ext = extensionOf(clean);
  return `${clean.slice(0, 190)}.${ext}`;
}
