import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageFallback } from "@/components/PageFallback";
import { APP_TIME_ZONE } from "@/config/ai";
import { fileTypeLabel, listFilesAdmin } from "@/lib/admin/queries";

export const metadata: Metadata = { title: "Файлы учеников" };

const dateFormat = new Intl.DateTimeFormat("ru-RU", {
  timeZone: APP_TIME_ZONE,
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const TYPE_LABELS = { critical: "критическая", engineering: "инженерная" } as const;

function formatSize(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} КБ` : `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}

export default function AdminFilesPage() {
  return (
    <section>
      <h1 className="text-2xl font-bold text-ink">Файлы учеников</h1>
      <p className="mt-1 text-sm text-stone-600">Все файлы, отправленные с ответами. Ссылка действует 60 секунд после нажатия.</p>
      <Suspense fallback={<PageFallback />}>
        <FilesTable />
      </Suspense>
    </section>
  );
}

async function FilesTable() {
  const files = await listFilesAdmin();
  if (files.length === 0) return <p className="mt-4 text-stone-600">Файлов пока нет.</p>;
  return (
    <div className="mt-4 overflow-x-auto card">
      <table className="min-w-full text-sm">
        <thead className="bg-stone-50 text-left text-stone-600">
          <tr>
            <th className="px-4 py-2 font-medium">Загружен</th>
            <th className="px-4 py-2 font-medium">Ученик</th>
            <th className="px-4 py-2 font-medium">Класс</th>
            <th className="px-4 py-2 font-medium">Тема</th>
            <th className="px-4 py-2 font-medium">Задача</th>
            <th className="px-4 py-2 font-medium">Файл</th>
            <th className="px-4 py-2 font-medium">Тип</th>
            <th className="px-4 py-2 text-right font-medium">Размер</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100 tabular-nums">
          {files.map((file) => (
            <tr key={file.id} className="hover:bg-stone-50">
              <td className="px-4 py-2 whitespace-nowrap text-stone-600">{dateFormat.format(new Date(file.created_at))}</td>
              <td className="px-4 py-2 whitespace-nowrap">
                {file.student ? (
                  <Link href={`/admin/students/${file.user_id}`} className="text-brand-700 hover:underline">
                    {file.student.name}
                  </Link>
                ) : (
                  "—"
                )}
              </td>
              <td className="px-4 py-2">{file.student?.class || "—"}</td>
              <td className="px-4 py-2 whitespace-nowrap">
                {file.topic ? `${file.topic.order_number}. ${file.topic.title}` : "—"}
              </td>
              <td className="px-4 py-2">{file.type ? TYPE_LABELS[file.type] : "—"}</td>
              <td className="max-w-56 truncate px-4 py-2">
                <a href={`/files/${file.id}`} target="_blank" rel="noopener noreferrer" className="text-brand-700 hover:underline">
                  {file.file_name}
                </a>
              </td>
              <td className="px-4 py-2">{fileTypeLabel(file.mime_type)}</td>
              <td className="px-4 py-2 text-right whitespace-nowrap">{formatSize(file.size_bytes)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
