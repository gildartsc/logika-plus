import "server-only";
import { randomUUID } from "node:crypto";
import type { AiAttachment } from "@/lib/ai";
import { FILE_LIMITS, FILE_TYPES, STORAGE_BUCKET, type FileMime } from "@/config/files";
import { createAdminClient } from "@/lib/supabase/admin";
import { detectMime, extensionOf, hasMacros, mimeForName, sanitizeFileName } from "./detect";
import { extractDocxText } from "./docx";
import { stripJpegMetadata, stripPngMetadata } from "./metadata";

// All storage access uses the service role; callers authorize the user first.

export type UploadSlot = { id: string; path: string; token: string; name: string };

// What the grader receives for one file (defined by the AI module).
export type GraderFile = AiAttachment;

export type VerifiedFile = { id: string; mime: FileMime; size: number; grader: GraderFile };

type AttachmentRow = {
  id: string;
  user_id: string;
  task_id: string;
  submission_id: string | null;
  file_name: string;
  mime_type: FileMime;
  size_bytes: number;
  storage_path: string;
  created_at: string;
};

export class FileError extends Error {}

const PENDING_TTL_MS = 24 * 60 * 60 * 1000;
const typeList = Object.values(FILE_TYPES).map((t) => t.label).join(", ");
const megabytes = FILE_LIMITS.maxBytes / 1024 / 1024;

export type UploadRequest = { name: string; size: number };

function storage() {
  return createAdminClient().storage.from(STORAGE_BUCKET);
}

// Pending uploads that were never sent with an answer.
async function cleanupStalePending(userId: string): Promise<void> {
  const db = createAdminClient();
  const before = new Date(Date.now() - PENDING_TTL_MS).toISOString();
  const { data } = await db
    .from("attachments")
    .select("id, storage_path")
    .eq("user_id", userId)
    .is("submission_id", null)
    .lt("created_at", before);
  const stale = (data ?? []) as Pick<AttachmentRow, "id" | "storage_path">[];
  if (stale.length === 0) return;
  await storage().remove(stale.map((row) => row.storage_path));
  await db.from("attachments").delete().in("id", stale.map((row) => row.id));
}

// Issues one-time upload URLs into the student's own folder. Names, sizes and
// count are checked first (validate-request.ts); content is checked later, in
// verifyUploads.
export async function prepareUploadSlots(
  userId: string,
  taskId: string,
  files: UploadRequest[],
): Promise<UploadSlot[]> {
  await cleanupStalePending(userId);
  const db = createAdminClient();
  const slots: UploadSlot[] = [];

  for (const file of files) {
    const mime = mimeForName(file.name) as FileMime;
    const ext = extensionOf(file.name);
    const path = `${userId}/${randomUUID()}.${ext}`;
    const name = sanitizeFileName(file.name);

    const { data: signed, error: signError } = await storage().createSignedUploadUrl(path);
    if (signError || !signed) throw new Error(`Failed to sign upload: ${signError?.name}`);

    const { data: row, error } = await db
      .from("attachments")
      .insert({ user_id: userId, task_id: taskId, file_name: name, mime_type: mime, size_bytes: file.size, storage_path: path })
      .select("id")
      .single<{ id: string }>();
    if (error || !row) throw new Error(`Failed to create attachment: ${error?.code}`);
    slots.push({ id: row.id, path, token: signed.token, name });
  }
  return slots;
}

function sanitize(mime: FileMime, bytes: Uint8Array): Uint8Array {
  if (mime === "image/jpeg") return stripJpegMetadata(bytes);
  if (mime === "image/png") return stripPngMetadata(bytes);
  return bytes;
}

async function toGraderFile(mime: FileMime, name: string, bytes: Uint8Array): Promise<GraderFile> {
  const base64 = Buffer.from(bytes).toString("base64");
  if (mime === "image/jpeg" || mime === "image/png") return { kind: "image", mime, base64 };
  if (mime === "application/pdf") return { kind: "pdf", base64 };
  return { kind: "docx", name, text: await extractDocxText(bytes) };
}

// Checks every uploaded file by content, removes photo metadata (rewriting the
// stored object) and prepares it for the grader. Throws FileError with a
// message for the student.
export async function verifyUploads(userId: string, taskId: string, ids: string[]): Promise<VerifiedFile[]> {
  if (ids.length === 0) return [];
  if (ids.length > FILE_LIMITS.maxFiles) throw new FileError(`Можно прикрепить не больше ${FILE_LIMITS.maxFiles} файлов`);

  const { data, error } = await createAdminClient()
    .from("attachments")
    .select("id, user_id, task_id, submission_id, file_name, mime_type, size_bytes, storage_path, created_at")
    .in("id", ids);
  if (error) throw new Error(`Failed to read attachments: ${error.code}`);
  const rows = (data ?? []) as AttachmentRow[];

  const verified: VerifiedFile[] = [];
  for (const id of ids) {
    const row = rows.find((r) => r.id === id);
    // Someone else's file, another task, or one already sent with an answer.
    if (!row || row.user_id !== userId || row.task_id !== taskId || row.submission_id !== null) {
      throw new FileError("Файл не найден. Прикрепите его ещё раз");
    }

    const { data: blob, error: downloadError } = await storage().download(row.storage_path);
    if (downloadError || !blob) throw new FileError(`Файл «${row.file_name}» не загрузился. Прикрепите его ещё раз`);
    const bytes = new Uint8Array(await blob.arrayBuffer());

    if (bytes.length === 0 || bytes.length > FILE_LIMITS.maxBytes) {
      throw new FileError(`Файл «${row.file_name}» больше ${megabytes} МБ или пустой`);
    }
    const mime = detectMime(bytes);
    if (!mime) throw new FileError(`Файл «${row.file_name}» не похож на ${typeList}. Сохраните его в одном из этих форматов`);
    if (mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" && hasMacros(bytes)) {
      throw new FileError(`Файл «${row.file_name}» содержит макросы. Сохраните документ как обычный .docx`);
    }

    const clean = sanitize(mime, bytes);
    if (clean !== bytes) {
      const { error: uploadError } = await storage().upload(row.storage_path, clean, { contentType: mime, upsert: true });
      if (uploadError) throw new Error(`Failed to store cleaned file: ${uploadError.name}`);
    }

    let grader: GraderFile;
    try {
      grader = await toGraderFile(mime, row.file_name, clean);
    } catch {
      throw new FileError(`Файл «${row.file_name}» не удалось прочитать`);
    }
    verified.push({ id: row.id, mime, size: clean.length, grader });
  }
  return verified;
}

export async function attachToSubmission(files: VerifiedFile[], submissionId: string): Promise<void> {
  const db = createAdminClient();
  for (const file of files) {
    const { error } = await db
      .from("attachments")
      .update({ submission_id: submissionId, mime_type: file.mime, size_bytes: file.size })
      .eq("id", file.id)
      .is("submission_id", null);
    if (error) throw new Error(`Failed to attach file: ${error.code}`);
  }
}

export type FileLink = { url: string } | null;

// Short-lived link for the owner or an admin; null for anyone else.
export async function signedFileUrl(
  attachmentId: string,
  viewer: { id: string; role: "student" | "admin" },
): Promise<FileLink> {
  const { data, error } = await createAdminClient()
    .from("attachments")
    .select("user_id, file_name, mime_type, storage_path, submission_id")
    .eq("id", attachmentId)
    .maybeSingle<Pick<AttachmentRow, "user_id" | "file_name" | "mime_type" | "storage_path" | "submission_id">>();
  if (error) throw new Error(`Failed to read attachment: ${error.code}`);
  if (!data || data.submission_id === null) return null;
  if (viewer.role !== "admin" && viewer.id !== data.user_id) return null;

  // Word files are downloaded; images and PDFs open in the browser.
  const isDocx = data.mime_type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  const { data: signed, error: signError } = await storage().createSignedUrl(
    data.storage_path,
    60,
    isDocx ? { download: data.file_name } : undefined,
  );
  if (signError || !signed) throw new Error(`Failed to sign file URL: ${signError?.name}`);
  return { url: signed.signedUrl };
}

// Called before deleting a student: rows cascade, storage objects do not.
export async function removeUserFiles(userId: string): Promise<void> {
  const { data, error } = await createAdminClient().from("attachments").select("storage_path").eq("user_id", userId);
  if (error) throw new Error(`Failed to list files: ${error.code}`);
  const paths = ((data ?? []) as { storage_path: string }[]).map((row) => row.storage_path);
  for (let i = 0; i < paths.length; i += 100) {
    const { error: removeError } = await storage().remove(paths.slice(i, i + 100));
    if (removeError) throw new Error(`Failed to remove files: ${removeError.name}`);
  }
}
