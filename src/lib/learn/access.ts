import "server-only";
import { findOpenTask } from "./data";
import { taskIdSchema } from "./validation";

export const TASK_UNAVAILABLE = "Задача недоступна";
export const TOPIC_LOCKED = "Эта тема пока закрыта. Сначала пройди все темы предыдущей четверти";

export type TaskAccess =
  | { ok: true; userId: string; taskId: string; taskStatus: "not_started" | "in_progress" | "solved" }
  | { ok: false; error: string };

// Signed-in student + valid id + task exists + its topic is open.
export async function authorizeTask(taskId: unknown): Promise<TaskAccess> {
  const parsed = taskIdSchema.safeParse(taskId);
  if (!parsed.success) return { ok: false, error: TASK_UNAVAILABLE };
  const found = await findOpenTask(parsed.data);
  if (!found) return { ok: false, error: TASK_UNAVAILABLE };
  if (found.locked) return { ok: false, error: TOPIC_LOCKED };
  return { ok: true, userId: found.profile.id, taskId: parsed.data, taskStatus: found.task.status };
}
