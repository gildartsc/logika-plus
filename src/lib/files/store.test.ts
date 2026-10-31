import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const OWNER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const TASK = "33333333-3333-4333-8333-333333333333";
const OTHER_TASK = "44444444-4444-4444-8444-444444444444";
const FILE = "55555555-5555-4555-8555-555555555555";

type Row = Record<string, unknown>;

const db = vi.hoisted(() => ({
  rows: [] as Row[],
  objects: new Map<string, Uint8Array>(),
  uploads: [] as { path: string; bytes: Uint8Array }[],
  removed: [] as string[],
  signed: [] as { path: string; options: unknown }[],
}));

// Minimal fake of the attachments table and the storage bucket.
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => {
      const filters: ((row: Row) => boolean)[] = [];
      const result = () => db.rows.filter((row) => filters.every((f) => f(row)));
      const self = {
        select: () => self,
        in: (col: string, values: unknown[]) => (filters.push((r) => values.includes(r[col])), self),
        eq: (col: string, value: unknown) => (filters.push((r) => r[col] === value), self),
        is: (col: string, value: unknown) => (filters.push((r) => r[col] === value), self),
        lt: () => (filters.push(() => false), self),
        maybeSingle: async () => ({ data: result()[0] ?? null, error: null }),
        then: (resolve: (v: unknown) => void) => resolve({ data: result(), error: null }),
      };
      return self;
    },
    storage: {
      from: () => ({
        download: async (path: string) => {
          const bytes = db.objects.get(path);
          return bytes ? { data: new Blob([bytes.slice()]), error: null } : { data: null, error: { name: "NotFound" } };
        },
        upload: async (path: string, bytes: Uint8Array) => {
          db.uploads.push({ path, bytes });
          return { error: null };
        },
        remove: async (paths: string[]) => {
          db.removed.push(...paths);
          return { error: null };
        },
        createSignedUrl: async (path: string, _ttl: number, options: unknown) => {
          db.signed.push({ path, options });
          return { data: { signedUrl: `https://storage.example/${path}?token=t` }, error: null };
        },
      }),
    },
  }),
}));

const { FileError, removeUserFiles, signedFileUrl, verifyUploads } = await import("./store");

function attachment(overrides: Row = {}): Row {
  return {
    id: FILE,
    user_id: OWNER,
    task_id: TASK,
    submission_id: null,
    file_name: "рисунок.png",
    mime_type: "image/png",
    size_bytes: 100,
    storage_path: `${OWNER}/a.png`,
    created_at: "2026-10-08T10:00:00Z",
    ...overrides,
  };
}

// A PNG with a text chunk that must disappear.
const png = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0, 0, 0, 13, ...Buffer.from("IHDR"), ...Array(13).fill(1), 1, 2, 3, 4,
  0, 0, 0, 4, ...Buffer.from("tEXt"), ...Buffer.from("Ivan"), 1, 2, 3, 4,
  0, 0, 0, 0, ...Buffer.from("IEND"), 1, 2, 3, 4,
]);

beforeEach(() => {
  db.rows = [];
  db.objects.clear();
  db.uploads = [];
  db.removed = [];
  db.signed = [];
});

describe("verifyUploads", () => {
  it("accepts the owner's pending file, strips metadata and rewrites it", async () => {
    db.rows = [attachment()];
    db.objects.set(`${OWNER}/a.png`, png);
    const [file] = await verifyUploads(OWNER, TASK, [FILE]);
    expect(file.mime).toBe("image/png");
    expect(file.grader.kind).toBe("image");
    expect(db.uploads).toHaveLength(1);
    expect(Buffer.from(db.uploads[0].bytes).toString("latin1")).not.toContain("Ivan");
  });

  it.each([
    ["another student's upload", { user_id: OTHER }],
    ["an upload for another task", { task_id: OTHER_TASK }],
    ["a file already sent with an answer", { submission_id: "sub-1" }],
  ])("refuses %s", async (_case, overrides) => {
    db.rows = [attachment(overrides)];
    db.objects.set(`${OWNER}/a.png`, png);
    await expect(verifyUploads(OWNER, TASK, [FILE])).rejects.toBeInstanceOf(FileError);
  });

  it("refuses a file whose content is not an allowed type", async () => {
    db.rows = [attachment({ file_name: "photo.jpg", mime_type: "image/jpeg" })];
    db.objects.set(`${OWNER}/a.png`, Uint8Array.from(Buffer.from("MZ executable")));
    await expect(verifyUploads(OWNER, TASK, [FILE])).rejects.toThrow(/не похож/);
  });

  it("refuses a Word file with macros", async () => {
    db.rows = [attachment({ file_name: "work.docx", mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" })];
    db.objects.set(`${OWNER}/a.png`, new Uint8Array(readFileSync("test/fixtures/macro.docx")));
    await expect(verifyUploads(OWNER, TASK, [FILE])).rejects.toThrow(/макросы/);
  });

  it("extracts text from a Word file for the grader", async () => {
    db.rows = [attachment({ file_name: "work.docx", mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" })];
    db.objects.set(`${OWNER}/a.png`, new Uint8Array(readFileSync("test/fixtures/sample.docx")));
    const [file] = await verifyUploads(OWNER, TASK, [FILE]);
    expect(file.grader).toMatchObject({ kind: "docx", name: "work.docx" });
    expect(file.grader.kind === "docx" ? file.grader.text : "").toContain("Факт можно проверить");
  });

  it("refuses a file that was never uploaded", async () => {
    db.rows = [attachment()];
    await expect(verifyUploads(OWNER, TASK, [FILE])).rejects.toThrow(/не загрузился/);
  });

  it("refuses an oversized file even if the browser lied about its size", async () => {
    db.rows = [attachment()];
    db.objects.set(`${OWNER}/a.png`, new Uint8Array(5 * 1024 * 1024 + 1));
    await expect(verifyUploads(OWNER, TASK, [FILE])).rejects.toThrow(/больше 5 МБ/);
  });
});

describe("signedFileUrl", () => {
  const sent = () => attachment({ submission_id: "sub-1" });

  it("gives the owner a short-lived link", async () => {
    db.rows = [sent()];
    expect(await signedFileUrl(FILE, { id: OWNER, role: "student" })).toEqual({
      url: `https://storage.example/${OWNER}/a.png?token=t`,
    });
  });

  it("gives an admin a link to any student's file", async () => {
    db.rows = [sent()];
    expect(await signedFileUrl(FILE, { id: OTHER, role: "admin" })).not.toBeNull();
  });

  it("gives another student nothing", async () => {
    db.rows = [sent()];
    expect(await signedFileUrl(FILE, { id: OTHER, role: "student" })).toBeNull();
    expect(db.signed).toHaveLength(0);
  });

  it("does not open uploads that were never sent with an answer", async () => {
    db.rows = [attachment()];
    expect(await signedFileUrl(FILE, { id: OWNER, role: "student" })).toBeNull();
  });

  it("downloads Word files under their name", async () => {
    db.rows = [attachment({ submission_id: "sub-1", file_name: "work.docx", mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" })];
    await signedFileUrl(FILE, { id: OWNER, role: "student" });
    expect(db.signed[0].options).toEqual({ download: "work.docx" });
  });
});

describe("removeUserFiles", () => {
  it("removes every stored object of the student", async () => {
    db.rows = [attachment(), attachment({ id: "x", storage_path: `${OWNER}/b.pdf` }), attachment({ user_id: OTHER, storage_path: `${OTHER}/c.pdf` })];
    await removeUserFiles(OWNER);
    expect(db.removed.sort()).toEqual([`${OWNER}/a.png`, `${OWNER}/b.pdf`]);
  });
});
