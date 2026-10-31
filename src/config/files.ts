// Limits for files attached to an answer (SPEC section 2).
export const FILE_LIMITS = {
  maxFiles: 3,
  maxBytes: 5 * 1024 * 1024,
  // Input-token ceiling for one answer check with files (about $0.05 on Sonnet).
  maxGradingInputTokens: 25_000,
  // Text taken from a DOCX for the grader.
  maxDocxChars: 20_000,
} as const;

export const FILE_TYPES = {
  "image/jpeg": { extensions: ["jpg", "jpeg"], label: "JPG" },
  "image/png": { extensions: ["png"], label: "PNG" },
  "application/pdf": { extensions: ["pdf"], label: "PDF" },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": { extensions: ["docx"], label: "DOCX" },
} as const;

export type FileMime = keyof typeof FILE_TYPES;

export const STORAGE_BUCKET = "answer-files";
// MIME types make phones offer the gallery and camera, extensions cover
// file managers that ignore types.
export const ACCEPT_ATTRIBUTE = [
  ...Object.keys(FILE_TYPES),
  ...Object.values(FILE_TYPES).flatMap((t) => t.extensions.map((ext) => `.${ext}`)),
].join(",");
