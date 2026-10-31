import { describe, expect, it, vi } from "vitest";
import { studentCode } from "./csv";

const STUDENT = { id: "22222222-2222-4222-8222-222222222222", name: "Анна Смирнова", email: "anna@school.ru", class: "9А", total_points: 0, is_blocked: false, created_at: "" };
const ADMIN_ID = "11111111-1111-4111-8111-111111111111";

const tables: Record<string, unknown[]> = {
  users: [STUDENT],
  topics: [{ id: "t1", order_number: 1, title: "Факт или мнение", description: "" }],
  tasks: [{ id: "k1", topic_id: "t1", type: "critical" }],
  attachments: [
    { submission_id: "sub-1", mime_type: "image/jpeg" },
    { submission_id: "sub-1", mime_type: "application/pdf" },
  ],
  submissions: [
    { id: "sub-1", user_id: STUDENT.id, task_id: "k1", answer_text: "=1+1 мой ответ", ai_status: "solved", criteria_met: [1, 2], ai_feedback: "Хорошо", created_at: "2026-10-07T09:00:00Z" },
    { id: "sub-2", user_id: ADMIN_ID, task_id: "k1", answer_text: "тест админа", ai_status: null, criteria_met: null, ai_feedback: null, created_at: "2026-10-07T10:00:00Z" },
  ],
  chat_history: [
    { user_id: STUDENT.id, task_id: "k1", role: "user", message: "Меня зовут Анна Смирнова", created_at: "2026-10-07T08:00:00Z" },
  ],
};

vi.mock("@/lib/auth/guards", () => ({ requireAdmin: vi.fn(async () => ({ id: ADMIN_ID, role: "admin" })) }));
vi.mock("@/lib/learn/ai-store", () => ({ getMonthSpendUsd: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const self = {
        select: () => self,
        eq: () => self,
        not: () => self,
        order: () => self,
        range: async (from: number) => ({ data: from === 0 ? tables[table] : [], error: null }),
      };
      return self;
    },
  }),
}));

const { buildAttemptsCsv, buildChatsCsv } = await import("./queries");

describe("research export", () => {
  it("replaces the student by a code and leaves out names, e-mails and admin rows", async () => {
    const csv = await buildAttemptsCsv();
    expect(csv).toContain(studentCode(STUDENT.id));
    expect(csv).not.toContain("Анна");
    expect(csv).not.toContain("anna@school.ru");
    expect(csv).not.toContain("тест админа");
    expect(csv).toContain("'=1+1 мой ответ");
    expect(csv).toContain("2026-10-07 12:00:00"); // Moscow time
    expect(csv).toContain(";JPG, PDF;solved;1,2;");
  });

  it("exports chats with the same student code", async () => {
    const csv = await buildChatsCsv();
    expect(csv).toContain(`${studentCode(STUDENT.id)};9А;1;Факт или мнение;критическое`);
    expect(csv).toContain(";ученик;");
  });
});
