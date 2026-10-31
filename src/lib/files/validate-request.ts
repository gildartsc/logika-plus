import { FILE_LIMITS, FILE_TYPES } from "@/config/files";
import { mimeForName, sanitizeFileName } from "./detect";

const typeList = Object.values(FILE_TYPES).map((t) => t.label).join(", ");
const megabytes = FILE_LIMITS.maxBytes / 1024 / 1024;

// Checks what the browser says about the files before any upload URL is
// issued. The real content is verified after upload.
export function validateUploadRequest(files: { name: string; size: number }[]): string | null {
  if (files.length === 0) return "Выберите файл";
  if (files.length > FILE_LIMITS.maxFiles) return `Можно прикрепить не больше ${FILE_LIMITS.maxFiles} файлов`;
  for (const file of files) {
    const name = sanitizeFileName(file.name);
    if (!mimeForName(file.name)) return `Файл «${name}»: можно только ${typeList}`;
    if (!Number.isFinite(file.size) || file.size <= 0) return `Файл «${name}» пустой`;
    if (file.size > FILE_LIMITS.maxBytes) return `Файл «${name}» больше ${megabytes} МБ`;
  }
  return null;
}
