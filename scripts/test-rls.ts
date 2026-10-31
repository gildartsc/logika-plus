// Checks database access rules against the real Supabase project.
// Usage: npm run test:rls
// Creates two temporary students, signs in as them with the public anon key
// and checks what they can read and write. Temporary users are always deleted.
import { randomBytes, randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anonKey || !serviceKey) {
  console.error("Ошибка: заполните переменные Supabase в .env.local");
  process.exit(1);
}

const options = { auth: { persistSession: false, autoRefreshToken: false } };
const BUCKET = "answer-files";
const admin = createClient(url, serviceKey, options);

type TestUser = { id: string; client: SupabaseClient };
const results: { name: string; ok: boolean; detail?: string }[] = [];

function check(name: string, ok: boolean, detail?: string) {
  results.push({ name, ok, detail });
}

async function createStudent(label: string): Promise<TestUser> {
  const email = `rls-test-${randomUUID()}@example.com`;
  const password = randomBytes(24).toString("base64url");
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name: label, class: "test" },
  });
  if (error || !data.user) throw new Error(`createUser: ${error?.message}`);

  const client = createClient(url!, anonKey!, options);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw new Error(`signIn: ${signInError.message}`);
  return { id: data.user.id, client };
}

async function seedStudentData(userId: string, taskId: string) {
  const rows = [
    admin.from("user_progress").insert({ user_id: userId, task_id: taskId, status: "in_progress" }),
    admin.from("submissions").insert({ user_id: userId, task_id: taskId, answer_text: "тест" }),
    admin.from("chat_history").insert({ user_id: userId, task_id: taskId, role: "user", message: "тест" }),
    admin.from("ai_usage").insert({ user_id: userId, task_id: taskId, model: "test" }),
  ];
  for (const { error } of await Promise.all(rows)) {
    if (error) throw new Error(`seed: ${error.message}`);
  }

  // A stored file and its metadata row.
  const path = `${userId}/rls-test.png`;
  const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const upload = await admin.storage.from(BUCKET).upload(path, png, { contentType: "image/png", upsert: true });
  if (upload.error) throw new Error(`seed file: ${upload.error.message}`);
  const meta = await admin.from("attachments").insert({
    user_id: userId,
    task_id: taskId,
    file_name: "rls-test.png",
    mime_type: "image/png",
    size_bytes: png.length,
    storage_path: path,
  });
  if (meta.error) throw new Error(`seed attachment: ${meta.error.message}`);
}

async function runChecks(a: TestUser, b: TestUser, taskId: string) {
  // Hidden task fields.
  const all = await b.client.from("tasks").select("*");
  check("tasks: select * запрещён", all.error !== null);
  for (const column of ["ai_context", "grading_criteria", "common_mistakes", "hint_1", "hint_2", "hint_3"]) {
    const res = await b.client.from("tasks").select(column).limit(1);
    check(`tasks: поле ${column} закрыто`, res.error !== null);
  }
  const publicCols = await b.client.from("tasks").select("id, topic_id, type, public_text");
  check("tasks: публичные поля читаются", !publicCols.error && (publicCols.data?.length ?? 0) > 0, publicCols.error?.message);

  const topics = await b.client.from("topics").select("id, title");
  check("topics: темы читаются", !topics.error && (topics.data?.length ?? 0) > 0, topics.error?.message);

  // Own vs. foreign rows.
  for (const table of ["user_progress", "submissions", "chat_history"]) {
    const own = await a.client.from(table).select("user_id");
    check(`${table}: ученик видит свои строки`, !own.error && own.data?.length === 1, own.error?.message);
    const foreign = await b.client.from(table).select("user_id").eq("user_id", a.id);
    check(`${table}: чужие строки не видны`, !foreign.error && foreign.data?.length === 0, foreign.error?.message);
  }
  // Files: metadata rows are own-only; the bucket is closed to clients.
  const ownFiles = await a.client.from("attachments").select("id");
  check("attachments: ученик видит свои файлы", !ownFiles.error && ownFiles.data?.length === 1, ownFiles.error?.message);
  const foreignFiles = await b.client.from("attachments").select("id").eq("user_id", a.id);
  check("attachments: чужие файлы не видны", !foreignFiles.error && foreignFiles.data?.length === 0, foreignFiles.error?.message);
  const writeFile = await b.client.from("attachments").insert({
    user_id: b.id, task_id: taskId, file_name: "x.png", mime_type: "image/png", size_bytes: 1, storage_path: `${b.id}/x.png`,
  });
  check("attachments: ученик не может создать запись", writeFile.error !== null);

  const foreignDownload = await b.client.storage.from(BUCKET).download(`${a.id}/rls-test.png`);
  check("storage: чужой файл не скачивается", foreignDownload.error !== null);
  const ownDownload = await a.client.storage.from(BUCKET).download(`${a.id}/rls-test.png`);
  check("storage: даже свой файл напрямую не скачивается (только через сервер)", ownDownload.error !== null);
  const listing = await b.client.storage.from(BUCKET).list(a.id);
  check("storage: список чужих файлов пуст", listing.error !== null || listing.data?.length === 0);
  const directUpload = await b.client.storage
    .from(BUCKET)
    .upload(`${b.id}/direct.png`, Uint8Array.from([0x89, 0x50]), { contentType: "image/png" });
  check("storage: прямая загрузка без одноразовой ссылки запрещена", directUpload.error !== null);
  const guestDownload = await createClient(url!, anonKey!, options).storage.from(BUCKET).download(`${a.id}/rls-test.png`);
  check("storage: гость не скачивает файлы", guestDownload.error !== null);

  const users = await b.client.from("users").select("id");
  check("users: виден только свой профиль", !users.error && users.data?.length === 1 && users.data[0].id === b.id);

  const invites = await a.client.from("invite_codes").select("code");
  check("invite_codes: ученик не видит коды приглашения", invites.error !== null || invites.data?.length === 0);
  const guestInvites = await createClient(url!, anonKey!, options).from("invite_codes").select("code");
  check("invite_codes: гость не видит коды приглашения", guestInvites.error !== null || guestInvites.data?.length === 0);
  const forgedInvite = await a.client.from("invite_codes").insert({ code: "ABCDEFGH" });
  check("invite_codes: ученик не может создать код", forgedInvite.error !== null);

  const usage = await a.client.from("ai_usage").select("id");
  check("ai_usage: нет доступа даже к своим записям", usage.error !== null || usage.data?.length === 0);

  // Writes.
  const insertProgress = await b.client
    .from("user_progress")
    .insert({ user_id: b.id, task_id: taskId, points_earned: 100, status: "solved" });
  check("user_progress: ученик не может создать запись", insertProgress.error !== null);

  const updatePoints = await a.client
    .from("user_progress")
    .update({ points_earned: 9999 })
    .eq("user_id", a.id)
    .select("id");
  check("user_progress: ученик не может менять баллы", updatePoints.error !== null || updatePoints.data?.length === 0);

  const insertChat = await b.client
    .from("chat_history")
    .insert({ user_id: b.id, task_id: taskId, role: "ai", message: "подделка" });
  check("chat_history: ученик не может писать напрямую", insertChat.error !== null);

  const promote = await b.client.from("users").update({ role: "admin" }).eq("id", b.id).select("id");
  check("users: ученик не может стать админом", promote.error !== null || promote.data?.length === 0);

  const award = await b.client.rpc("award_task_points", { p_user_id: b.id, p_task_id: taskId, p_points: 1000 });
  // 42501 = permission denied; a missing function would fail differently.
  check("award_task_points: ученик не может начислить себе баллы", award.error?.code === "42501", award.error?.code);

  const points = await b.client.from("users").update({ total_points: 1000 }).eq("id", b.id).select("id");
  check("users: ученик не может менять свои баллы", points.error !== null || points.data?.length === 0);

  const spend = await b.client.rpc("ai_spend_since", { since: "2000-01-01T00:00:00Z" });
  check("ai_spend_since: расходы на ИИ ученику недоступны", spend.error?.code === "42501", spend.error?.code);

  const editTask = await b.client.from("tasks").update({ public_text: "x" }).eq("id", taskId).select("id");
  check("tasks: ученик не может менять задачи", editTask.error !== null || editTask.data?.length === 0);

  // Guests.
  const guest = createClient(url!, anonKey!, options);
  const guestTopics = await guest.from("topics").select("id");
  check("гость: темы недоступны", guestTopics.error !== null || guestTopics.data?.length === 0);
  const guestTasks = await guest.from("tasks").select("id");
  check("гость: задачи недоступны", guestTasks.error !== null || guestTasks.data?.length === 0);
}

async function main() {
  const { data: task, error } = await admin.from("tasks").select("id").limit(1).maybeSingle();
  if (error || !task) {
    console.error("Ошибка: в базе нет задач. Сначала выполните npm run import:content");
    process.exit(1);
  }

  const created: TestUser[] = [];
  try {
    created.push(await createStudent("RLS A"), await createStudent("RLS B"));
    await seedStudentData(created[0].id, task.id);
    await runChecks(created[0], created[1], task.id);
  } finally {
    for (const user of created) {
      await admin.storage.from(BUCKET).remove([`${user.id}/rls-test.png`, `${user.id}/direct.png`]);
      // Cascades to profile, progress, submissions and chat; ai_usage keeps a null user.
      await admin.auth.admin.deleteUser(user.id);
    }
    await admin.from("ai_usage").delete().eq("model", "test").is("user_id", null);
  }

  for (const r of results) {
    console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.ok || !r.detail ? "" : ` (${r.detail})`}`);
  }
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\nИтого: ${results.length - failed} из ${results.length} проверок пройдено.`);
  if (failed > 0) process.exit(1);
}

await main();
