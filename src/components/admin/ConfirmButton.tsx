"use client";

import { useState, useTransition } from "react";
import type { ActionResult } from "@/lib/admin/actions";

type Props = {
  label: string;
  confirmLabel: string;
  warning: string;
  action: () => Promise<ActionResult>;
  danger?: boolean;
};

// Two-step button: the first click asks, the second one acts.
export function ConfirmButton({ label, confirmLabel, warning, action, danger = true }: Props) {
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const tone = danger
    ? "border-red-300 text-red-700 hover:bg-red-50"
    : "border-stone-300 text-stone-700 hover:bg-stone-50";

  function run() {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setError(result.error);
      setAsking(false);
    });
  }

  return (
    <div>
      {!asking ? (
        <button type="button" onClick={() => setAsking(true)} className={`rounded-lg border px-3 py-2 text-sm font-medium ${tone}`}>
          {label}
        </button>
      ) : (
        <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
          <p className="text-sm text-stone-700">{warning}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={run}
              disabled={pending}
              className={`rounded-lg px-3 py-2 text-sm font-medium text-white disabled:opacity-60 ${danger ? "bg-red-600 hover:bg-red-700" : "bg-brand-600 hover:bg-brand-700"}`}
            >
              {pending ? "Подождите…" : confirmLabel}
            </button>
            <button
              type="button"
              onClick={() => setAsking(false)}
              className="rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-700 hover:bg-white"
            >
              Отмена
            </button>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
