import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageFallback } from "@/components/PageFallback";
import { APP_TIME_ZONE } from "@/config/ai";
import { listStudentsAdmin } from "@/lib/admin/queries";

export const metadata: Metadata = { title: "Ученики" };

const dateFormat = new Intl.DateTimeFormat("ru-RU", {
  timeZone: APP_TIME_ZONE,
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export default function AdminStudentsPage() {
  return (
    <section>
      <h1 className="text-2xl font-bold text-ink">Ученики</h1>
      <Suspense fallback={<PageFallback />}>
        <StudentTable />
      </Suspense>
    </section>
  );
}

async function StudentTable() {
  const { students, totalTopics } = await listStudentsAdmin();
  if (students.length === 0) return <p className="mt-4 text-stone-600">Учеников пока нет.</p>;
  return (
    <div className="mt-4 overflow-x-auto card">
      <table className="min-w-full text-sm">
        <thead className="bg-stone-50 text-left text-stone-600">
          <tr>
            <th className="px-4 py-2 font-medium">Имя</th>
            <th className="px-4 py-2 font-medium">Класс</th>
            <th className="px-4 py-2 font-medium">E-mail</th>
            <th className="px-4 py-2 text-right font-medium">XP</th>
            <th className="px-4 py-2 text-right font-medium">Темы</th>
            <th className="px-4 py-2 font-medium">Активность</th>
            <th className="px-4 py-2 font-medium">Статус</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100 tabular-nums">
          {students.map((s) => (
            <tr key={s.id} className="hover:bg-stone-50">
              <td className="px-4 py-2 whitespace-nowrap">
                <Link href={`/admin/students/${s.id}`} className="font-medium text-brand-700 hover:underline">
                  {s.name}
                </Link>
              </td>
              <td className="px-4 py-2">{s.class || "—"}</td>
              <td className="px-4 py-2 text-stone-600">{s.email}</td>
              <td className="px-4 py-2 text-right">{s.total_points}</td>
              <td className="px-4 py-2 text-right whitespace-nowrap">
                {s.completedTopics} / {totalTopics}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-stone-600">
                {s.lastActivity ? dateFormat.format(new Date(s.lastActivity)) : "—"}
              </td>
              <td className="px-4 py-2">
                {s.is_blocked ? (
                  <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-700">заблокирован</span>
                ) : (
                  <span className="text-xs text-stone-500">активен</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
