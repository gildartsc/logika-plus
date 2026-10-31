import { randomInt } from "node:crypto";
import { CODE_ALPHABET, INVITE_CODE_LENGTH } from "./code";

export function generateInviteCode(): string {
  return Array.from({ length: INVITE_CODE_LENGTH }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
}
