import type { Metadata } from "next";

export const metadata: Metadata = { title: "Экспорт" };

// Plain links; each route checks the admin role itself.
export default function AdminExportPage() {
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold text-ink">Экспорт для исследования</h1>
      <p className="max-w-2xl text-stone-600">
        Файлы CSV для Excel (разделитель «;», кодировка UTF-8). Имена и e-mail заменены кодами учеников вида
        S-3f1c1b: код одинаков во всех выгрузках. Данные администраторов в выгрузку не попадают.
      </p>
      <div className="flex flex-wrap gap-3">
        <a href="/admin/export/attempts" className="btn-primary">
          Журнал попыток
        </a>
        <a href="/admin/export/chats" className="btn-primary">
          Журнал чатов
        </a>
      </div>
    </section>
  );
}
