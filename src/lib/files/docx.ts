import mammoth from "mammoth";
import { FILE_LIMITS } from "@/config/files";

// Plain text of a Word document for the grader; images inside are ignored.
export async function extractDocxText(bytes: Uint8Array): Promise<string> {
  const { value } = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
  const text = value.replace(/\n{3,}/g, "\n\n").trim();
  return text.length > FILE_LIMITS.maxDocxChars ? `${text.slice(0, FILE_LIMITS.maxDocxChars)}\n[текст обрезан]` : text;
}
