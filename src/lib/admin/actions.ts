"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/guards";
import { toTaskRow } from "@/lib/content/rows";
import { removeUserFiles } from "@/lib/files/store";
import { INVITE_BATCH_MAX, INVITE_NOTE_MAX, isInviteCode } from "@/lib/invites/code";
import { generateInviteCode } from "@/lib/invites/generate";
import { createAdminClient } from "@/lib/supabase/admin";
import { firstErrors, parseTaskForm, parseTopicForm } from "./forms";
import { generateTemporaryPassword } from "./password";
import { countStudentData } from "./queries";

export type FormState = { ok?: boolean; error?: string; fieldErrors?: Record<string, string> };
export type ActionResult = { ok: true } | { ok: false; error: string };
export type PasswordResult = { ok: true; password: string } | { ok: false; error: string };
export type InvitesResult = { ok: true; codes: string[] } | { ok: false; error: string };

const idSchema = z.uuid();
const SERVER_ERROR = "Не получилось сохранить. Попробуйте ещё раз";
const HAS_STUDENT_DATA =
  "Удалить нельзя: по этим задачам уже есть ответы, переписка или прогресс учеников. Отредактируйте задачу вместо удаления";

function logError(action: string, code: string | undefined) {
  console.error(`Admin ${action} failed:`, code ?? "unknown");
}

// --- Topics ------------------------------------------------------------------

export async function saveTopic(topicId: string | null, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  if (topicId !== null && !idSchema.safeParse(topicId).success) return { error: "Тема не найдена" };

  const parsed = parseTopicForm(formData);
  if (!parsed.success) return { fieldErrors: firstErrors(parsed.error) };

  const db = createAdminClient();
  const query = topicId
    ? db.from("topics").update(parsed.data).eq("id", topicId).select("id").single<{ id: string }>()
    : db.from("topics").insert(parsed.data).select("id").single<{ id: string }>();
  const { data, error } = await query;
  if (error?.code === "23505") {
    return { fieldErrors: { order_number: "Тема с таким номером уже есть" } };
  }
  if (error || !data) {
    logError("saveTopic", error?.code);
    return { error: SERVER_ERROR };
  }

  if (!topicId) redirect(`/admin/topics/${data.id}`);
  refresh();
  return { ok: true };
}

export async function deleteTopic(topicId: string): Promise<ActionResult> {
  await requireAdmin();
  if (!idSchema.safeParse(topicId).success) return { ok: false, error: "Тема не найдена" };

  const db = createAdminClient();
  const { data: tasks, error } = await db.from("tasks").select("id").eq("topic_id", topicId);
  if (error) {
    logError("deleteTopic", error.code);
    return { ok: false, error: SERVER_ERROR };
  }
  if ((await countStudentData((tasks ?? []).map((t) => t.id as string))) > 0) {
    return { ok: false, error: HAS_STUDENT_DATA };
  }

  const { error: deleteError } = await db.from("topics").delete().eq("id", topicId);
  if (deleteError) {
    logError("deleteTopic", deleteError.code);
    return { ok: false, error: SERVER_ERROR };
  }
  redirect("/admin/topics");
}

// --- Tasks -------------------------------------------------------------------

export async function saveTask(topicId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  if (!idSchema.safeParse(topicId).success) return { error: "Тема не найдена" };

  const parsed = parseTaskForm(formData);
  if (!parsed.success) return { fieldErrors: firstErrors(parsed.error) };

  const { error } = await createAdminClient()
    .from("tasks")
    .upsert(toTaskRow(parsed.data, topicId), { onConflict: "topic_id,type" });
  if (error) {
    logError("saveTask", error.code);
    return { error: SERVER_ERROR };
  }
  refresh();
  return { ok: true };
}

export async function deleteTask(taskId: string): Promise<ActionResult> {
  await requireAdmin();
  if (!idSchema.safeParse(taskId).success) return { ok: false, error: "Задача не найдена" };
  if ((await countStudentData([taskId])) > 0) return { ok: false, error: HAS_STUDENT_DATA };

  const { error } = await createAdminClient().from("tasks").delete().eq("id", taskId);
  if (error) {
    logError("deleteTask", error.code);
    return { ok: false, error: SERVER_ERROR };
  }
  refresh();
  return { ok: true };
}

// --- Students ----------------------------------------------------------------

// Student actions apply only to students: never to the admin themself or
// to another admin.
async function loadTarget(userId: string): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const admin = await requireAdmin();
  if (!idSchema.safeParse(userId).success || userId === admin.id) {
    return { ok: false, error: "Действие доступно только для учеников" };
  }
  const { data, error } = await createAdminClient()
    .from("users")
    .select("id, role")
    .eq("id", userId)
    .maybeSingle<{ id: string; role: string }>();
  if (error) {
    logError("loadTarget", error.code);
    return { ok: false, error: SERVER_ERROR };
  }
  if (!data || data.role !== "student") return { ok: false, error: "Действие доступно только для учеников" };
  return { ok: true, id: data.id };
}

export async function setStudentBlocked(userId: string, blocked: boolean): Promise<ActionResult> {
  const target = await loadTarget(userId);
  if (!target.ok) return target;
  if (typeof blocked !== "boolean") return { ok: false, error: SERVER_ERROR };

  const { error } = await createAdminClient().from("users").update({ is_blocked: blocked }).eq("id", target.id);
  if (error) {
    logError("setStudentBlocked", error.code);
    return { ok: false, error: SERVER_ERROR };
  }
  refresh();
  return { ok: true };
}

export async function resetStudentPassword(userId: string): Promise<PasswordResult> {
  const target = await loadTarget(userId);
  if (!target.ok) return target;

  const password = generateTemporaryPassword();
  const { error } = await createAdminClient().auth.admin.updateUserById(target.id, { password });
  if (error) {
    logError("resetStudentPassword", error.code);
    return { ok: false, error: "Не получилось сбросить пароль. Попробуйте ещё раз" };
  }
  // Shown to the admin once; never logged or stored in plain text.
  return { ok: true, password };
}

export async function deleteStudent(userId: string): Promise<ActionResult> {
  const target = await loadTarget(userId);
  if (!target.ok) return target;

  // Stored files first: database rows cascade, storage objects do not.
  try {
    await removeUserFiles(target.id);
  } catch (error) {
    logError("deleteStudent files", (error as Error).message);
    return { ok: false, error: "Не получилось удалить файлы ученика. Попробуйте ещё раз" };
  }

  // Cascades to the profile, progress, answers, files and chat (SPEC section 7);
  // ai_usage rows keep their cost with an empty user.
  const { error } = await createAdminClient().auth.admin.deleteUser(target.id);
  if (error) {
    logError("deleteStudent", error.code);
    return { ok: false, error: "Не получилось удалить ученика. Попробуйте ещё раз" };
  }
  redirect("/admin/students");
}

// --- Invite codes ------------------------------------------------------------

const inviteBatchSchema = z.object({
  count: z.coerce.number().int().min(1).max(INVITE_BATCH_MAX),
  note: z.string().trim().max(INVITE_NOTE_MAX),
});

export async function createInvites(count: number, note: string): Promise<InvitesResult> {
  await requireAdmin();
  const parsed = inviteBatchSchema.safeParse({ count, note });
  if (!parsed.success) {
    return { ok: false, error: `Можно создать от 1 до ${INVITE_BATCH_MAX} кодов, подпись до ${INVITE_NOTE_MAX} символов` };
  }

  const codes = [...new Set(Array.from({ length: parsed.data.count }, generateInviteCode))];
  // A clash with an existing code is practically impossible (31^8 codes);
  // such a code is simply skipped.
  const { data, error } = await createAdminClient()
    .from("invite_codes")
    .upsert(codes.map((code) => ({ code, note: parsed.data.note })), { onConflict: "code", ignoreDuplicates: true })
    .select("code");
  if (error) {
    logError("createInvites", error.code);
    return { ok: false, error: SERVER_ERROR };
  }
  refresh();
  return { ok: true, codes: (data ?? []).map((row) => row.code as string) };
}

// Only unused codes can be deleted: used ones show who registered with them.
export async function deleteInvite(code: string): Promise<ActionResult> {
  await requireAdmin();
  if (typeof code !== "string" || !isInviteCode(code)) return { ok: false, error: "Код не найден" };

  const { data, error } = await createAdminClient()
    .from("invite_codes")
    .delete()
    .eq("code", code)
    .is("used_at", null)
    .select("code");
  if (error) {
    logError("deleteInvite", error.code);
    return { ok: false, error: SERVER_ERROR };
  }
  if ((data ?? []).length === 0) return { ok: false, error: "Код уже использован, удалить его нельзя" };
  refresh();
  return { ok: true };
}
