"use client";

import { useState, useTransition } from "react";
import { deleteStudent, resetStudentPassword, setStudentBlocked } from "@/lib/admin/actions";
import { ConfirmButton } from "./ConfirmButton";

export function StudentActions({ userId, blocked }: { userId: string; blocked: boolean }) {
  const [password, setPassword] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function resetPassword() {
    setError(null);
    startTransition(async () => {
      const result = await resetStudentPassword(userId);
      if (result.ok) setPassword(result.password);
      else setError(result.error);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <ConfirmButton
          label={blocked ? "Разблокировать" : "Заблокировать"}
          confirmLabel={blocked ? "Да, разблокировать" : "Да, заблокировать"}
          warning={blocked ? "Ученик снова сможет входить и решать задачи." : "Ученик не сможет войти, пока вы его не разблокируете."}
          action={() => setStudentBlocked(userId, !blocked)}
          danger={!blocked}
        />
        <button
          type="button"
          onClick={resetPassword}
          disabled={pending}
          className="rounded-lg border border-stone-300 px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-60"
        >
          {pending ? "Сбрасываем…" : "Сбросить пароль"}
        </button>
        <ConfirmButton
          label="Удалить ученика"
          confirmLabel="Да, удалить навсегда"
          warning="Будут удалены профиль, прогресс, ответы и переписка ученика. Отменить нельзя."
          action={() => deleteStudent(userId)}
        />
      </div>
      {password && (
        <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          <p>
            Временный пароль: <code className="rounded bg-white px-2 py-0.5 text-base font-semibold">{password}</code>
          </p>
          <p className="mt-1">Передайте его ученику лично. Он показан один раз и нигде не сохраняется.</p>
        </div>
      )}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
