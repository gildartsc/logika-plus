import { HINTS_PER_TASK } from "@/config/limits";

export type TaskHints = { hint_1: string; hint_2: string; hint_3: string };

export function clampHintsUsed(count: number): number {
  return Math.min(Math.max(Math.trunc(count), 0), HINTS_PER_TASK);
}

export function openedHints(task: TaskHints, hintsUsed: number): string[] {
  return [task.hint_1, task.hint_2, task.hint_3].slice(0, clampHintsUsed(hintsUsed));
}

// Returns the 1-based number of the next hint, or null when all are open.
export function nextHintNumber(hintsUsed: number): number | null {
  const used = clampHintsUsed(hintsUsed);
  return used >= HINTS_PER_TASK ? null : used + 1;
}
