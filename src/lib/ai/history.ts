import type Anthropic from "@anthropic-ai/sdk";
import type { ChatTurn } from "./types.ts";

// Keeps the last `window` turns in API format. The API needs the first
// message to come from the user, so leading assistant turns are dropped.
export function toApiMessages(turns: ChatTurn[], window: number): Anthropic.MessageParam[] {
  const recent = turns.slice(-window);
  const firstUser = recent.findIndex((turn) => turn.role === "user");
  if (firstUser === -1) return [];
  return recent.slice(firstUser).map((turn) => ({
    role: turn.role === "ai" ? "assistant" : "user",
    content: turn.message,
  }));
}
