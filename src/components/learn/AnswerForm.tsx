"use client";

import { useRef, useState, useTransition } from "react";
import { BulbIcon, CheckIcon, ClipIcon, SendIcon, XpCoin } from "@/components/icons";
import { ACCEPT_ATTRIBUTE, FILE_LIMITS, STORAGE_BUCKET } from "@/config/files";
import { ANSWER_MAX_CHARS } from "@/config/limits";
import { mimeForName } from "@/lib/files/detect";
import { addPickedFiles } from "@/lib/files/pick";
import { prepareUploads, submitAnswer, type AnswerResult } from "@/lib/learn/actions";
import { ANSWER_TEXT_REQUIRED } from "@/lib/learn/validation";
import { browserSupabase } from "@/lib/supabase/browser";

type Props = {
  taskId: string;
  solved: boolean;
  onGraded: (result: Extract<AnswerResult, { ok: true }>, sentFiles: number) => void;
};

const MAX_MB = FILE_LIMITS.maxBytes / 1024 / 1024;

function formatSize(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} КБ` : `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}

export function AnswerForm({ taskId, solved, onGraded }: Props) {
  const [answer, setAnswer] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [stage, setStage] = useState<string | null>(null);
  const [pickError, setPickError] = useState<string | null>(null);
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [pending, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);
  const inputId = `answer-${taskId}`;

  function addFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    // Copy first: a FileList is live and empties when the input is reset
    // (the reset lets the same file be picked again).
    const picked = Array.from(list);
    if (fileInput.current) fileInput.current.value = "";
    const next = addPickedFiles(files, picked);
    setFiles(next.files);
    setPickError(next.error);
    setResult(null);
  }

  // Quick checks for a friendly message; the server checks everything again.
  const tooBig = files.find((file) => file.size > FILE_LIMITS.maxBytes);
  const hasText = answer.trim().length > 0;
  const canSend = hasText && !tooBig;

  function fail(error: string) {
    setResult({ ok: false, error, saved: false });
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResult(null);
    startTransition(async () => {
      let uploadIds: string[] = [];
      if (files.length > 0) {
        setStage("Загружаем файлы…");
        const prepared = await prepareUploads(
          taskId,
          files.map((file) => ({ name: file.name, size: file.size })),
        );
        if (!prepared.ok) {
          setStage(null);
          return fail(prepared.error);
        }
        const storage = browserSupabase().storage.from(STORAGE_BUCKET);
        for (const [index, slot] of prepared.slots.entries()) {
          const file = files[index];
          // Browsers sometimes leave the type of .docx empty, and the bucket
          // accepts only the four allowed types; the server checks content later.
          const { error } = await storage.uploadToSignedUrl(slot.path, slot.token, file, {
            contentType: mimeForName(file.name) ?? "application/octet-stream",
          });
          if (error) {
            setStage(null);
            return fail(`Файл «${slot.name}» не загрузился. Проверьте интернет и попробуйте ещё раз`);
          }
        }
        uploadIds = prepared.slots.map((slot) => slot.id);
      }

      setStage("Наставник проверяет…");
      const next = await submitAnswer(taskId, answer, uploadIds);
      setStage(null);
      setResult(next);
      if (next.ok) {
        onGraded(next, uploadIds.length);
        setFiles([]);
        if (next.status === "solved") setAnswer("");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-3 border-t-2 border-dashed border-line pt-5">
      <label htmlFor={inputId} className="block font-bold text-ink">
        Твой ответ
      </label>
      {solved && (
        <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-700">
          <CheckIcon className="h-4 w-4" /> Задача уже решена. Можно отправить ответ ещё раз, чтобы получить отзыв.
        </p>
      )}
      <textarea
        id={inputId}
        name="answer"
        rows={7}
        maxLength={ANSWER_MAX_CHARS}
        value={answer}
        onChange={(event) => setAnswer(event.target.value)}
        placeholder="Объясни ход мысли своими словами"
        className="field"
      />

      <div className="rounded-xl border-2 border-dashed border-line bg-paper p-3">
        <div className="flex flex-wrap items-center gap-3">
          <label
            className={`btn-secondary cursor-pointer px-3 py-2 text-sm ${
              files.length >= FILE_LIMITS.maxFiles ? "pointer-events-none opacity-50" : ""
            }`}
          >
            <ClipIcon className="h-4 w-4" /> Прикрепить файл
            <input
              ref={fileInput}
              type="file"
              multiple
              accept={ACCEPT_ATTRIBUTE}
              onChange={(event) => addFiles(event.target.files)}
              className="sr-only"
              disabled={files.length >= FILE_LIMITS.maxFiles}
            />
          </label>
          <span className="text-xs text-stone-500">
            JPG, PNG, PDF, DOCX · до {FILE_LIMITS.maxFiles} файлов · до {MAX_MB} МБ каждый
          </span>
        </div>
        {files.length > 0 && (
          <ul className="mt-3 space-y-1">
            {files.map((file, index) => (
              <li key={`${file.name}-${index}`} className="flex items-center justify-between gap-2 text-sm">
                <span className={`min-w-0 truncate ${file.size > FILE_LIMITS.maxBytes ? "text-red-600" : "text-stone-700"}`}>
                  {file.name} · {formatSize(file.size)}
                  {file.size > FILE_LIMITS.maxBytes && ` — больше ${MAX_MB} МБ`}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setFiles((current) => current.filter((_, i) => i !== index));
                    setPickError(null);
                  }}
                  className="shrink-0 text-xs text-stone-500 hover:text-red-600"
                  aria-label={`Убрать ${file.name}`}
                >
                  убрать
                </button>
              </li>
            ))}
          </ul>
        )}
        {pickError && (
          <p role="alert" className="mt-2 text-sm text-red-600">
            {pickError}
          </p>
        )}
        {files.length > 0 && !hasText && (
          <p className="mt-2 text-sm font-medium text-gold-800">{ANSWER_TEXT_REQUIRED}.</p>
        )}
        <p className="mt-2 text-xs text-stone-500">
          Фотографируй только решение: без лица, фамилии и других личных данных.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs text-stone-500">
          {answer.length} / {ANSWER_MAX_CHARS}
        </span>
        <button
          type="submit"
          disabled={pending || !canSend}
          className="btn-primary px-6"
        >
          {!pending && <SendIcon className="h-4 w-4" />}
          {pending ? (stage ?? "Отправляем…") : "Отправить"}
        </button>
      </div>
      {result && !result.ok && (
        <p role="alert" className="rounded-xl border-2 border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {result.error}
        </p>
      )}
      {result?.ok && (
        <div
          role="status"
          className={`flex gap-3 rounded-2xl border-2 p-4 text-sm ${
            result.status === "solved"
              ? "border-emerald-300 bg-emerald-50 text-emerald-950"
              : "border-gold-300 bg-gold-100 text-ink"
          }`}
        >
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
              result.status === "solved" ? "bg-emerald-500 text-white" : "bg-gold-400 text-ink"
            }`}
          >
            {result.status === "solved" ? <CheckIcon className="h-6 w-6" /> : <BulbIcon className="h-5 w-5" />}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-base font-bold">
                {result.status === "solved" ? "Решение принято!" : "Решение пока не принято."}
              </p>
              {result.pointsAwarded > 0 && (
                <span className="flex animate-pop items-center gap-1 rounded-full bg-gold-400 py-0.5 pr-2.5 pl-1 font-extrabold text-ink shadow-[0_2px_0_var(--color-gold-600)]">
                  <XpCoin className="h-5 w-5" /> +{result.pointsAwarded} XP
                </span>
              )}
            </div>
            <p className="mt-1">{result.feedback}</p>
          </div>
        </div>
      )}
    </form>
  );
}
