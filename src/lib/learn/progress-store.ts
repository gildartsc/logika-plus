import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { TaskStatus } from "./data";

export type ProgressRow = {
  status: TaskStatus;
  attempts_count: number;
  hints_used: number;
  ai_messages_count: number;
};

type Patch = Partial<ProgressRow> & { completed_at?: string };

const MAX_RETRIES = 3;

// Applies a change to the student's progress row for a task.
// The update only succeeds if the row still has the values it was computed
// from, so two parallel requests cannot both use the same old value.
// `change` returns null to stop without writing.
export async function updateProgress(
  userId: string,
  taskId: string,
  change: (row: ProgressRow) => Patch | null,
): Promise<{ row: ProgressRow; patch: Patch | null }> {
  const admin = createAdminClient();

  const { error: insertError } = await admin
    .from("user_progress")
    .upsert({ user_id: userId, task_id: taskId }, { onConflict: "user_id,task_id", ignoreDuplicates: true });
  if (insertError) throw new Error(`Failed to create progress: ${insertError.code}`);

  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    const { data: row, error: readError } = await admin
      .from("user_progress")
      .select("status, attempts_count, hints_used, ai_messages_count")
      .eq("user_id", userId)
      .eq("task_id", taskId)
      .single<ProgressRow>();
    if (readError || !row) throw new Error(`Failed to read progress: ${readError?.code}`);

    const patch = change(row);
    if (!patch) return { row, patch: null };

    const { data: updated, error: updateError } = await admin
      .from("user_progress")
      .update(patch)
      .eq("user_id", userId)
      .eq("task_id", taskId)
      .eq("status", row.status)
      .eq("attempts_count", row.attempts_count)
      .eq("hints_used", row.hints_used)
      .eq("ai_messages_count", row.ai_messages_count)
      .select("status, attempts_count, hints_used, ai_messages_count");
    if (updateError) throw new Error(`Failed to update progress: ${updateError.code}`);
    if (updated && updated.length === 1) {
      return { row: updated[0] as ProgressRow, patch };
    }
  }
  throw new Error("Progress update conflict");
}
