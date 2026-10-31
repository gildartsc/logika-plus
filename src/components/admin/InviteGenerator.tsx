"use client";

import { useState, useTransition } from "react";
import { createInvites } from "@/lib/admin/actions";
import { INVITE_BATCH_MAX, INVITE_NOTE_MAX, formatInviteCode } from "@/lib/invites/code";

export function InviteGenerator() {
  const [count, setCount] = useState(5);
  const [note, setNote] = useState("");
  const [codes, setCodes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setCopied(false);
    startTransition(async () => {
      const result = await createInvites(count, note);
      if (result.ok) setCodes(result.codes);
      else setError(result.error);
    });
  }

  const text = codes.map(formatInviteCode).join("\n");

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="card p-5">
      <form onSubmit={create} className="flex flex-wrap items-end gap-3">
        <label className="block text-sm">
          <span className="font-medium text-stone-700">Сколько кодов</span>
          <input
            type="number"
            min={1}
            max={INVITE_BATCH_MAX}
            value={count}
            onChange={(event) => setCount(Number(event.target.value))}
            className="field mt-1 w-24"
          />
        </label>
        <label className="block min-w-48 flex-1 text-sm">
          <span className="font-medium text-stone-700">Подпись (необязательно)</span>
          <input
            value={note}
            maxLength={INVITE_NOTE_MAX}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Например, 9А пилот"
            className="field mt-1"
          />
        </label>
        <button type="submit" disabled={pending} className="btn-primary px-4 py-2">
          {pending ? "Создаём…" : "Создать коды"}
        </button>
      </form>
      {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
      {codes.length > 0 && (
        <div role="status" className="mt-4">
          <p className="text-sm text-stone-700">
            Новые коды. Каждый работает для одной регистрации: дайте по одному коду каждому ученику.
          </p>
          <textarea readOnly value={text} rows={Math.min(codes.length, 10)} className="field mt-2 font-mono" />
          <button type="button" onClick={copy} className="btn-secondary mt-2 px-3 py-1.5 text-sm">
            {copied ? "Скопировано" : "Скопировать все"}
          </button>
        </div>
      )}
    </div>
  );
}
