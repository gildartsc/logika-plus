"use client";

import { useState, useTransition } from "react";
import { HINTS_PER_TASK } from "@/config/limits";
import { BulbIcon } from "@/components/icons";
import { openHint } from "@/lib/learn/actions";

export function HintPanel({ taskId, initialHints }: { taskId: string; initialHints: string[] }) {
  const [hints, setHints] = useState(initialHints);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const left = HINTS_PER_TASK - hints.length;

  function handleOpen() {
    setError(null);
    startTransition(async () => {
      const result = await openHint(taskId);
      if (result.ok) {
        setHints((current) => [...current, result.hint].slice(0, result.hintsUsed));
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <section className="mt-6 border-t-2 border-dashed border-line pt-5" aria-label="Подсказки">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-bold text-ink">
          <BulbIcon className="h-5 w-5 text-gold-600" /> Подсказки
        </h2>
        {/* Remaining hints as pips: filled = still available. */}
        <span className="flex items-center gap-1" aria-label={`Осталось подсказок: ${left} из ${HINTS_PER_TASK}`}>
          {Array.from({ length: HINTS_PER_TASK }, (_, i) => (
            <span
              key={i}
              aria-hidden
              className={`h-2.5 w-6 rounded-full ${i < left ? "bg-gold-400" : "bg-line"}`}
            />
          ))}
        </span>
      </div>
      {hints.length > 0 && (
        <ol className="mt-3 space-y-2">
          {hints.map((hint, index) => (
            <li
              key={index}
              className="animate-pop rounded-xl border-2 border-gold-300 bg-gold-100 px-4 py-3 text-sm text-ink"
            >
              <span className="mr-1 font-bold text-gold-800">#{index + 1}</span> {hint}
            </li>
          ))}
        </ol>
      )}
      <div className="mt-3">
        {left > 0 ? (
          <button type="button" onClick={handleOpen} disabled={pending} className="btn-gold px-3 py-2 text-sm">
            <BulbIcon className="h-4 w-4" />
            {pending ? "Открываем…" : `Открыть подсказку (осталось ${left})`}
          </button>
        ) : (
          <p className="text-sm text-stone-500">Все подсказки открыты.</p>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      )}
    </section>
  );
}
