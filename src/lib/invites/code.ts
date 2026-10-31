// Shared by the browser form and the server: no Node-only imports here.
// No look-alike characters (0/O, 1/I/L), so a code is easy to dictate.
export const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const INVITE_CODE_LENGTH = 8;
export const INVITE_BATCH_MAX = 50;
export const INVITE_NOTE_MAX = 100;

// Students may type the code in lower case, with spaces or with the dash
// from the printed form "ABCD-EFGH".
export function normalizeInviteCode(input: string): string {
  return input.replace(/[\s-]/g, "").toUpperCase();
}

export function isInviteCode(code: string): boolean {
  return /^[A-HJ-NP-Z2-9]{8}$/.test(code);
}

export function formatInviteCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}
