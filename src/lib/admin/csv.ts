import { createHash } from "node:crypto";

// Excel in Russian locale opens ";"-separated UTF-8 files with a BOM correctly.
const BOM = "﻿";
const SEPARATOR = ";";

// Pseudonymous code instead of name/e-mail (SPEC section 7). Stable across
// exports because it is derived from the user id only.
export function studentCode(userId: string): string {
  return `S-${createHash("sha256").update(userId).digest("hex").slice(0, 6)}`;
}

// Cells starting with these characters run as formulas in spreadsheet apps.
const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  let text = String(value);
  if (typeof value === "string" && FORMULA_START.test(text)) text = `'${text}`;
  if (/[";\n\r]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function toCsv(header: string[], rows: (string | number | null | undefined)[][]): string {
  const lines = [header, ...rows].map((row) => row.map(csvCell).join(SEPARATOR));
  return BOM + lines.join("\r\n") + "\r\n";
}
