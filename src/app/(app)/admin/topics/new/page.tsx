import type { Metadata } from "next";
import Link from "next/link";
import { TopicForm } from "@/components/admin/TopicForm";

export const metadata: Metadata = { title: "Новая тема" };

// No data is read here; saveTopic checks the admin role on submit.
export default function NewTopicPage() {
  return (
    <section className="space-y-4">
      <Link href="/admin/topics" className="text-sm text-brand-600 hover:underline">
        ← Все темы
      </Link>
      <h1 className="text-2xl font-bold text-ink">Новая тема</h1>
      <div className="card p-5">
        <TopicForm topic={null} />
      </div>
      <p className="text-sm text-stone-500">Задачи можно добавить после создания темы.</p>
    </section>
  );
}
