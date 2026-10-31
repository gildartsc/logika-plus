import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageFallback } from "@/components/PageFallback";
import { listTopicsAdmin } from "@/lib/admin/queries";

export const metadata: Metadata = { title: "Темы и задачи" };

export default function AdminTopicsPage() {
  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-ink">Темы и задачи</h1>
        <Link href="/admin/topics/new" className="btn-primary text-sm">
          Новая тема
        </Link>
      </div>
      <Suspense fallback={<PageFallback />}>
        <TopicList />
      </Suspense>
    </section>
  );
}

function TaskMark({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs ${ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
      {ok ? "✓" : "нет"} {label}
    </span>
  );
}

async function TopicList() {
  const topics = await listTopicsAdmin();
  if (topics.length === 0) return <p className="mt-4 text-stone-600">Тем пока нет.</p>;
  return (
    <ol className="mt-4 divide-y divide-stone-100 card">
      {topics.map((topic) => (
        <li key={topic.id}>
          <Link href={`/admin/topics/${topic.id}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-stone-50">
            <span className="font-medium text-stone-800">
              {topic.order_number}. {topic.title}
            </span>
            <span className="flex gap-2">
              <TaskMark ok={topic.hasCritical} label="критическая" />
              <TaskMark ok={topic.hasEngineering} label="инженерная" />
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}
