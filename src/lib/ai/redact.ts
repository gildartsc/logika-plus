// Masks contact details a student may type, before the text is stored or
// sent to the AI. Names cannot be detected reliably; the prompt covers them.

export const REDACTED = "[скрыто]";

const EMAIL = /[^\s@<>()]+@[^\s@<>()]+\.[^\s@<>().,;:!?]+/g;
// Digit runs with phone-like separators; checked by digit count below.
const PHONE_CANDIDATE = /\+?\d[\d\s\-()]{8,}\d/g;

// Russian numbers: 11 digits starting with 7 or 8 (+7 900 123-45-67,
// 8-900-123-45-67) or 10 digits starting with 9 (900 123 45 67). Other digit
// runs, such as lists of years, are left alone.
function isPhone(candidate: string): boolean {
  const digits = candidate.replace(/\D/g, "");
  return (digits.length === 11 && /^[78]/.test(digits)) || (digits.length === 10 && digits.startsWith("9"));
}

export function redactPersonalData(text: string): string {
  return text
    .replace(EMAIL, REDACTED)
    .replace(PHONE_CANDIDATE, (match) => (isPhone(match) ? REDACTED : match));
}
