import { beforeEach, describe, expect, it, vi } from "vitest";

const ADMIN_ID = "11111111-1111-4111-8111-111111111111";
const STUDENT_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_ADMIN_ID = "33333333-3333-4333-8333-333333333333";
const TOPIC_ID = "44444444-4444-4444-8444-444444444444";

const m = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  countStudentData: vi.fn(),
  dbCalls: [] as string[],
  users: {} as Record<string, { id: string; role: string }>,
  updateUserById: vi.fn(),
  deleteUser: vi.fn(),
  refresh: vi.fn(),
  removeUserFiles: vi.fn(),
}));

vi.mock("@/lib/files/store", () => ({ removeUserFiles: m.removeUserFiles }));

vi.mock("@/lib/auth/guards", () => ({ requireAdmin: m.requireAdmin }));
vi.mock("./queries", () => ({ countStudentData: m.countStudentData }));
vi.mock("next/cache", () => ({ refresh: m.refresh }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

// A permissive query builder that records which tables were touched.
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    const builder = (table: string) => {
      m.dbCalls.push(table);
      let id: string | undefined;
      const self = {
        select: () => self,
        update: () => self,
        insert: () => self,
        upsert: async () => ({ error: null }),
        delete: () => self,
        eq: (_c: string, value: string) => {
          id = value;
          return self;
        },
        maybeSingle: async () => ({ data: id ? (m.users[id] ?? null) : null, error: null }),
        single: async () => ({ data: { id: TOPIC_ID }, error: null }),
        then: (resolve: (v: unknown) => void) => resolve({ data: [{ id: "task-1" }], error: null }),
      };
      return self;
    };
    return {
      from: builder,
      auth: { admin: { updateUserById: m.updateUserById, deleteUser: m.deleteUser } },
    };
  },
}));

const actions = await import("./actions");

function asStudent() {
  m.requireAdmin.mockImplementation(async () => {
    throw new Error("REDIRECT:/learn");
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  m.dbCalls.length = 0;
  m.users = {
    [STUDENT_ID]: { id: STUDENT_ID, role: "student" },
    [OTHER_ADMIN_ID]: { id: OTHER_ADMIN_ID, role: "admin" },
    [ADMIN_ID]: { id: ADMIN_ID, role: "admin" },
  };
  m.requireAdmin.mockResolvedValue({ id: ADMIN_ID, role: "admin" });
  m.countStudentData.mockResolvedValue(0);
  m.updateUserById.mockResolvedValue({ error: null });
  m.deleteUser.mockResolvedValue({ error: null });
  m.removeUserFiles.mockResolvedValue(undefined);
});

describe("every admin action requires the admin role", () => {
  const topicForm = new FormData();
  const calls: [string, () => Promise<unknown>][] = [
    ["saveTopic", () => actions.saveTopic(null, {}, topicForm)],
    ["deleteTopic", () => actions.deleteTopic(TOPIC_ID)],
    ["saveTask", () => actions.saveTask(TOPIC_ID, {}, new FormData())],
    ["deleteTask", () => actions.deleteTask(TOPIC_ID)],
    ["setStudentBlocked", () => actions.setStudentBlocked(STUDENT_ID, true)],
    ["resetStudentPassword", () => actions.resetStudentPassword(STUDENT_ID)],
    ["deleteStudent", () => actions.deleteStudent(STUDENT_ID)],
  ];

  it.each(calls)("%s rejects a student before touching the database", async (_name, call) => {
    asStudent();
    await expect(call()).rejects.toThrow("REDIRECT:/learn");
    expect(m.dbCalls).toEqual([]);
    expect(m.updateUserById).not.toHaveBeenCalled();
    expect(m.deleteUser).not.toHaveBeenCalled();
  });
});

describe("topics and tasks", () => {
  it("refuses to delete a topic with student data", async () => {
    m.countStudentData.mockResolvedValue(3);
    const result = await actions.deleteTopic(TOPIC_ID);
    expect(result).toMatchObject({ ok: false });
    expect(m.dbCalls).not.toContain("topics");
  });

  it("deletes an unused topic", async () => {
    await expect(actions.deleteTopic(TOPIC_ID)).rejects.toThrow("REDIRECT:/admin/topics");
    expect(m.dbCalls).toContain("topics");
  });

  it("refuses to delete a task with student data", async () => {
    m.countStudentData.mockResolvedValue(1);
    expect(await actions.deleteTask(TOPIC_ID)).toMatchObject({ ok: false });
  });

  it("returns field errors for an invalid task", async () => {
    const result = await actions.saveTask(TOPIC_ID, {}, new FormData());
    expect(result.fieldErrors).toBeDefined();
    expect(m.dbCalls).toEqual([]);
  });

  it("rejects malformed ids", async () => {
    expect(await actions.deleteTopic("1 or 1=1")).toMatchObject({ ok: false });
    expect(await actions.saveTask("x", {}, new FormData())).toEqual({ error: "Тема не найдена" });
  });
});

describe("student actions", () => {
  it("blocks a student", async () => {
    expect(await actions.setStudentBlocked(STUDENT_ID, true)).toEqual({ ok: true });
  });

  it.each([
    ["themself", ADMIN_ID],
    ["another admin", OTHER_ADMIN_ID],
    ["an unknown user", "55555555-5555-4555-8555-555555555555"],
  ])("cannot act on %s", async (_who, id) => {
    expect(await actions.setStudentBlocked(id, true)).toMatchObject({ ok: false });
    expect(await actions.resetStudentPassword(id)).toMatchObject({ ok: false });
    expect(await actions.deleteStudent(id)).toMatchObject({ ok: false });
    expect(m.updateUserById).not.toHaveBeenCalled();
    expect(m.deleteUser).not.toHaveBeenCalled();
  });

  it("resets the password to a readable temporary one", async () => {
    const result = await actions.resetStudentPassword(STUDENT_ID);
    expect(result.ok).toBe(true);
    const password = result.ok ? result.password : "";
    expect(password).toMatch(/^[a-km-zA-HJ-NP-Z2-9]{12}$/);
    expect(m.updateUserById).toHaveBeenCalledWith(STUDENT_ID, { password });
  });

  it("deletes a student's files, then the student", async () => {
    await expect(actions.deleteStudent(STUDENT_ID)).rejects.toThrow("REDIRECT:/admin/students");
    expect(m.removeUserFiles).toHaveBeenCalledWith(STUDENT_ID);
    expect(m.deleteUser).toHaveBeenCalledWith(STUDENT_ID);
  });

  it("keeps the student when their files could not be removed", async () => {
    m.removeUserFiles.mockRejectedValue(new Error("storage down"));
    expect(await actions.deleteStudent(STUDENT_ID)).toMatchObject({ ok: false });
    expect(m.deleteUser).not.toHaveBeenCalled();
  });
});
