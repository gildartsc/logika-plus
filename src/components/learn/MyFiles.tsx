import { ClipIcon, FileIcon } from "@/components/icons";
import { APP_TIME_ZONE } from "@/config/ai";
import type { MyFile } from "./types";

const TYPE_LABELS: Record<string, string> = {
  "image/jpeg": "JPG",
  "image/png": "PNG",
  "application/pdf": "PDF",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
};

const dateFormat = new Intl.DateTimeFormat("ru-RU", {
  timeZone: APP_TIME_ZONE,
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

// The student's own files for this task; links open through /files/[id].
export function MyFiles({ files }: { files: MyFile[] }) {
  if (files.length === 0) return null;
  return (
    <section className="mt-6 rounded-xl bg-paper p-4" aria-label="Мои файлы">
      <h3 className="flex items-center gap-1.5 text-sm font-bold text-ink"><ClipIcon className="h-4 w-4" /> Мои файлы по задаче</h3>
      <ul className="mt-2 space-y-1">
        {files.map((file) => (
          <li key={file.id} className="flex flex-wrap items-center gap-2 text-sm">
            <FileIcon className="h-4 w-4 text-stone-400" />
            <a href={`/files/${file.id}`} target="_blank" rel="noopener noreferrer" className="font-medium text-brand-600 hover:underline">
              {file.name}
            </a>
            <span className="text-xs text-stone-500">
              {TYPE_LABELS[file.mime] ?? "файл"} · {dateFormat.format(new Date(file.createdAt))}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
