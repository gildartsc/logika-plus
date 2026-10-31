// The only task data that ever reaches the model. No student identity here.
export type AiTask = {
  public_text: string;
  ai_context: string;
  grading_criteria: string;
  common_mistakes: string;
};

export type ChatRole = "user" | "ai";
export type ChatTurn = { role: ChatRole; message: string };

export type AiUsage = {
  model: string;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
};

export type AiFailure = "refusal" | "error" | "invalid_output";

// A student's file as the grader receives it. DOCX arrives as extracted text.
export type AiAttachment =
  | { kind: "image"; mime: "image/jpeg" | "image/png"; base64: string }
  | { kind: "pdf"; base64: string }
  | { kind: "docx"; name: string; text: string };
