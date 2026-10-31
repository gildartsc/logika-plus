import { FILE_LIMITS, FILE_TYPES } from "@/config/files";
import { mimeForName } from "./detect";

const typeList = Object.values(FILE_TYPES).map((t) => t.label).join(", ");

// Adds newly picked files to the selection: keeps only allowed types, never
// more than the limit, and explains anything it had to leave out.
export function addPickedFiles<T extends { name: string }>(
  current: T[],
  picked: T[],
): { files: T[]; error: string | null } {
  const allowed = picked.filter((file) => mimeForName(file.name) !== null);
  const room = Math.max(FILE_LIMITS.maxFiles - current.length, 0);
  const files = [...current, ...allowed.slice(0, room)];

  const errors: string[] = [];
  const wrongType = picked.filter((file) => mimeForName(file.name) === null);
  if (wrongType.length > 0) {
    errors.push(`${wrongType.map((f) => `«${f.name}»`).join(", ")}: можно только ${typeList}`);
  }
  if (allowed.length > room) {
    errors.push(`Можно прикрепить не больше ${FILE_LIMITS.maxFiles} файлов`);
  }
  return { files, error: errors.length > 0 ? errors.join(". ") : null };
}
