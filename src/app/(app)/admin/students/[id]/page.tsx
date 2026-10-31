import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { StudentActions } from "@/components/admin/StudentActions";
import { PageFallback } from "@/components/PageFallback";
import { APP_TIME_ZONE } from "@/config/ai";
import { fileTypeLabel, getStudentAdmin } from "@/lib/admin/queries";

export const metadata: Metadata = { title: "Ученик" };

const dateFormat = new Intl.DateTimeFormat("ru-RU", { timeZone: APP_TIME_ZONE, day: "numeric", month: "short" });
const STATUS_LABELS = { not_started: "не начата", in_progress: "в работе", solved: "решена" } as const;
const VERDICT_LABELS: Record<string, string> = { solved: "принято", needs_work: "доработать" };
const timeFormat = new Intl.DateTimeFormat("ru-RU", {
  timeZone: APP_TIME_ZONE,
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});
const TYPE_LABELS = { critical: "критическая", engineering: "инженерная" } as const;

export default function AdminStudentPage({ params }: PageProps<"/admin/students/[id]">) {
  return (
    <section className="space-y-6">
      <Link href="/admin/students" className="text-sm text-brand-600 hover:underline">
        ← Все ученики
      </Link>
      <Suspense fallback={<PageFallback />}>
        <StudentDetails params={params} />
      </Suspense>
    </section>
  );
}

async function StudentDetails({ params }: { params: PageProps<"/admin/students/[id]">["params"] }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { student, stats, topics, monthSpendUsd, answers } = await getStudentAdmin(id);

  return (
    <>
      <div>
        <h1 className="text-2xl font-bold text-ink">{student.name}</h1>
        <p className="text-stone-600">
          {student.class ? `Класс ${student.class}` : "Класс не указан"} · {student.email}
          {student.is_blocked && <span className="ml-2 rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-700">заблокирован</span>}
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="XP" value={String(student.total_points)} />
        <Stat label="Тем пройдено" value={`${stats.completedTopics} / ${stats.totalTopics}`} />
        <Stat label="Подсказок" value={String(stats.hintsUsed)} />
        <Stat label="ИИ за месяц" value={`$${monthSpendUsd.toFixed(2)}`} />
      </dl>

      <div className="overflow-x-auto card">
        <table className="min-w-full text-sm">
          <thead className="bg-stone-50 text-left text-stone-600">
            <tr>
              <th className="px-4 py-2 font-medium">Тема</th>
              <th className="px-4 py-2 font-medium">Задача</th>
              <th className="px-4 py-2 font-medium">Статус</th>
              <th className="px-4 py-2 text-right font-medium">Попытки</th>
              <th className="px-4 py-2 text-right font-medium">Подсказки</th>
              <th className="px-4 py-2 text-right font-medium">Наставник</th>
              <th className="px-4 py-2 text-right font-medium">XP</th>
              <th className="px-4 py-2 font-medium">Решена</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100 tabular-nums">
            {topics.flatMap((topic) =>
              topic.tasks.map((task) => (
                <tr key={`${topic.order_number}-${task.type}`}>
                  <td className="px-4 py-2 whitespace-nowrap">
                    {topic.order_number}. {topic.title}
                  </td>
                  <td className="px-4 py-2">{TYPE_LABELS[task.type]}</td>
                  <td className="px-4 py-2">{STATUS_LABELS[task.status]}</td>
                  <td className="px-4 py-2 text-right">{task.attempts_count}</td>
                  <td className="px-4 py-2 text-right">{task.hints_used}</td>
                  <td className="px-4 py-2 text-right">{task.ai_messages_count}</td>
                  <td className="px-4 py-2 text-right">{task.points_earned}</td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    {task.completed_at ? dateFormat.format(new Date(task.completed_at)) : "—"}
                  </td>
                </tr>
              )),
            )}
          </tbody>
        </table>
      </div>

      <div className="card p-5">
        <h2 className="font-semibold text-ink">Ответы</h2>
        {answers.length === 0 ? (
          <p className="mt-2 text-sm text-stone-600">Ответов пока нет.</p>
        ) : (
          <ul className="mt-3 divide-y divide-stone-100">
            {answers.map((a) => (
              <li key={a.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2 text-sm">
                <span className="text-stone-500 tabular-nums">{timeFormat.format(new Date(a.createdAt))}</span>
                <span className="text-stone-800">
                  {a.topic ? `${a.topic.order_number}. ${a.topic.title}` : "—"}
                  {a.type && `, ${TYPE_LABELS[a.type]}`}
                </span>
                <span className="text-stone-600">{a.status ? VERDICT_LABELS[a.status] : "не проверен"}</span>
                {a.files.map((f) => (
                  <a key={f.id} href={`/files/${f.id}`} target="_blank" rel="noopener noreferrer" className="text-brand-700 hover:underline">
                    {f.file_name} ({fileTypeLabel(f.mime_type)})
                  </a>
                ))}
              </li>
            ))}
          </ul>
        )}
        {answers.length >= 50 && <p className="mt-2 text-xs text-stone-500">Показаны последние 50 ответов.</p>}
      </div>

      <div className="card p-5">
        <h2 className="mb-3 font-semibold text-ink">Действия</h2>
        <StudentActions userId={student.id} blocked={student.is_blocked} />
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <dt className="text-xs text-stone-500">{label}</dt>
      <dd className="mt-1 text-xl font-semibold text-ink">{value}</dd>
    </div>
  );
}
