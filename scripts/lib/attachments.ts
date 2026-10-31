// Turns local files into the attachments the grader receives, the same way
// the server does after verification (images and PDFs as-is, DOCX as text).
import { readFile } from "node:fs/promises";
import mammoth from "mammoth";
import type { AiAttachment } from "../../src/lib/ai/types.ts";

export async function loadAttachment(path: string): Promise<AiAttachment> {
  const bytes = await readFile(path);
  const lower = path.toLowerCase();
  if (lower.endsWith(".png")) return { kind: "image", mime: "image/png", base64: bytes.toString("base64") };
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
    return { kind: "image", mime: "image/jpeg", base64: bytes.toString("base64") };
  }
  if (lower.endsWith(".pdf")) return { kind: "pdf", base64: bytes.toString("base64") };
  if (lower.endsWith(".docx")) {
    const { value } = await mammoth.extractRawText({ buffer: bytes });
    return { kind: "docx", name: path.split("/").pop() ?? "file.docx", text: value.trim() };
  }
  throw new Error(`Unsupported fixture: ${path}`);
}
