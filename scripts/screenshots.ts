// Full-page screenshots of public and signed-in pages (desktop and phone)
// for checking the design. Drives the installed Firefox over WebDriver BiDi
// (built into Firefox, spoken here with Node's WebSocket), so it can wait
// until streamed content and fonts are in place. Needs a running app.
// Usage: npm run screenshots [-- --out=screenshots --base=http://localhost:3000 --only=learn-2]
// A temporary student with some progress is created and always deleted.
// No AI calls are made.
import { spawn } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

const arg = (name: string, fallback: string) =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? fallback;
const OUT = arg("out", "screenshots");
const BASE = arg("base", "http://localhost:3000");
const ONLY = arg("only", "");
const wanted = (name: string) => !ONLY || ONLY.split(",").includes(name);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const VIEWPORTS = { desktop: { width: 1280, height: 900 }, phone: { width: 390, height: 844 } };
const PUBLIC_PAGES = { landing: "/", login: "/login", register: "/register" };
const PRIVATE_PAGES = { "learn-1": "/learn/1", "learn-2": "/learn/2", profile: "/profile" };
// Opened panels: the page, then the button to press (by text or aria-label).
const OPENED_PANELS = {
  "topic-map": { path: "/learn/2", button: "Карта тем" },
  "mentor-drawer": { path: "/learn/2", button: "Открыть ИИ-наставника" },
};
// Visible while a Suspense boundary still waits for data.
const FALLBACK_TEXT = /Загрузка…|Загружаем/;

// --- Test student ------------------------------------------------------------

async function sessionCookies(email: string, password: string) {
  const jar = new Map<string, string>();
  const client = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (cookies) => cookies.forEach(({ name, value }) => jar.set(name, value)),
    },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`sign in: ${error.message}`);
  return jar;
}

// Topic 1 completed, work in progress on topic 2 (a hint and a short chat).
async function seed(userId: string) {
  const { data: tasks } = await admin.from("tasks").select("id, type, topics!inner(order_number)");
  const find = (order: number, type: string) =>
    tasks?.find((t) => t.type === type && (t.topics as unknown as { order_number: number }).order_number === order);
  const t1c = find(1, "critical");
  const t1e = find(1, "engineering");
  const t2c = find(2, "critical");
  if (!t1c || !t1e || !t2c) throw new Error("sample topics 1 and 2 are missing");

  await admin.rpc("award_task_points", { p_user_id: userId, p_task_id: t1c.id, p_points: 100 });
  await admin.rpc("award_task_points", { p_user_id: userId, p_task_id: t1e.id, p_points: 70 });
  await admin.from("user_progress").upsert(
    { user_id: userId, task_id: t2c.id, status: "in_progress", hints_used: 1, ai_messages_count: 1, attempts_count: 1 },
    { onConflict: "user_id,task_id" },
  );
  await admin.from("chat_history").insert([
    { user_id: userId, task_id: t2c.id, role: "user", message: "Мне кажется, адреса разные, значит и сети разные." },
    { user_id: userId, task_id: t2c.id, role: "ai", message: "Адреса и правда разные. А какую часть адреса определяет маска 255.255.255.0?" },
    { user_id: userId, task_id: t2c.id, role: "ai", message: "Отзыв на ответ: Ты верно выписал оба адреса. Подумай, какие октеты нужно сравнивать, чтобы понять, в одной ли они сети." },
  ]);
}

// --- WebDriver BiDi ----------------------------------------------------------

type Bidi = { send: (method: string, params: object) => Promise<Record<string, unknown>>; close: () => void };

async function startFirefox(): Promise<{ bidi: Bidi; stop: () => Promise<void> }> {
  const profile = await mkdtemp(join(tmpdir(), "shot-"));
  const port = 9300 + Math.floor(Math.random() * 500);
  const firefox = spawn("firefox", ["--headless", "--no-remote", "--profile", profile, `--remote-debugging-port=${port}`], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Firefox did not start")), 30_000);
    const onData = (chunk: Buffer) => {
      if (chunk.toString().includes("WebDriver BiDi listening")) {
        clearTimeout(timer);
        resolve();
      }
    };
    firefox.stdout.on("data", onData);
    firefox.stderr.on("data", onData);
  });

  const ws = new WebSocket(`ws://127.0.0.1:${port}/session`);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  let nextId = 1;
  const pending = new Map<number, { resolve: (v: Record<string, unknown>) => void; reject: (e: Error) => void }>();
  ws.onmessage = (event) => {
    const message = JSON.parse(String(event.data));
    const waiter = message.id !== undefined ? pending.get(message.id) : undefined;
    if (!waiter) return;
    pending.delete(message.id);
    if (message.type === "error") waiter.reject(new Error(`${message.error}: ${message.message}`));
    else waiter.resolve(message.result);
  };
  const bidi: Bidi = {
    send: (method, params) =>
      new Promise((resolve, reject) => {
        const id = nextId++;
        pending.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params }));
      }),
    close: () => ws.close(),
  };

  return {
    bidi,
    stop: async () => {
      bidi.close();
      firefox.kill();
      await rm(profile, { recursive: true, force: true });
    },
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function capture(
  bidi: Bidi,
  context: string,
  name: string,
  path: string,
  viewport: { width: number; height: number },
  pressButton?: string,
) {
  await bidi.send("browsingContext.setViewport", { context, viewport });
  await bidi.send("browsingContext.navigate", { context, url: `${BASE}${path}`, wait: "complete" });
  // Wait for streamed content, client-side redirects and fonts.
  for (let i = 0; i < 40; i++) {
    const result = await bidi.send("script.evaluate", {
      target: { context },
      awaitPromise: true,
      expression: `document.fonts.ready.then(() => !${FALLBACK_TEXT}.test(document.body.innerText))`,
    });
    if ((result.result as { value?: boolean }).value) break;
    await sleep(250);
  }
  if (pressButton) {
    await bidi.send("script.evaluate", {
      target: { context },
      awaitPromise: false,
      expression: `[...document.querySelectorAll("button")].find((b) => b.offsetParent !== null && (b.textContent.includes(${JSON.stringify(pressButton)}) || b.getAttribute("aria-label") === ${JSON.stringify(pressButton)}))?.click()`,
    });
  }
  await sleep(400); // let entry animations settle
  // Opened panels are fixed to the screen, so capture what the viewer sees.
  const shot = await bidi.send("browsingContext.captureScreenshot", { context, origin: pressButton ? "viewport" : "document" });
  await writeFile(join(OUT, `${name}.png`), Buffer.from(String(shot.data), "base64"));
}

// --- Main --------------------------------------------------------------------

async function main() {
  await mkdir(OUT, { recursive: true });
  const email = `design-shot-${randomUUID()}@example.com`;
  const password = randomBytes(24).toString("base64url");
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name: "Аня", class: "9А" },
  });
  if (error || !data.user) throw new Error(`createUser: ${error?.message}`);
  const userId = data.user.id;

  const { bidi, stop } = await startFirefox();
  try {
    await seed(userId);
    const cookies = await sessionCookies(email, password);
    await bidi.send("session.new", { capabilities: {} });
    const tree = await bidi.send("browsingContext.getTree", {});
    const context = (tree.contexts as { context: string }[])[0].context;

    for (const [view, size] of Object.entries(VIEWPORTS)) {
      for (const [name, path] of Object.entries(PUBLIC_PAGES)) {
        if (wanted(name)) await capture(bidi, context, `${name}-${view}`, path, size);
      }
    }

    const host = new URL(BASE).hostname;
    for (const [name, value] of cookies) {
      await bidi.send("storage.setCookie", {
        cookie: { name, value: { type: "string", value }, domain: host, path: "/", httpOnly: false, secure: false, sameSite: "lax" },
      });
    }
    for (const [view, size] of Object.entries(VIEWPORTS)) {
      for (const [name, path] of Object.entries(PRIVATE_PAGES)) {
        if (wanted(name)) await capture(bidi, context, `${name}-${view}`, path, size);
      }
    }
    for (const [view, size] of Object.entries(VIEWPORTS)) {
      for (const [name, panel] of Object.entries(OPENED_PANELS)) {
        if (!wanted(name)) continue;
        // The mentor drawer exists only on phones.
        if (name === "mentor-drawer" && view !== "phone") continue;
        await capture(bidi, context, `${name}-${view}`, panel.path, size, panel.button);
      }
    }
    console.log(`Скриншоты сохранены в ${OUT}/`);
  } finally {
    await stop();
    await admin.auth.admin.deleteUser(userId);
  }
}

await main();
