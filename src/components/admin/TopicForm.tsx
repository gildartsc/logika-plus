"use client";

import { startTransition, useActionState } from "react";
import { saveTopic, type FormState } from "@/lib/admin/actions";
import { Field } from "./Field";

type Props = {
  topic: { id: string; order_number: number; title: string; description: string } | null;
};

export function TopicForm({ topic }: Props) {
  const [state, action, pending] = useActionState(saveTopic.bind(null, topic?.id ?? null), {} as FormState);
  const errors = state.fieldErrors ?? {};

  return (
    <form
      // onSubmit instead of action={...}: a form action resets the fields
      // afterwards, which would wipe the admin's input on validation errors.
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(() => action(formData));
      }}
      className="space-y-4"
    >
      <div className="grid gap-4 sm:grid-cols-[8rem_1fr]">
        <Field label="Номер" name="order_number" type="number" defaultValue={topic?.order_number} error={errors.order_number} />
        <Field label="Название" name="title" maxLength={200} defaultValue={topic?.title} error={errors.title} />
      </div>
      <Field label="Описание" name="description" rows={2} maxLength={2000} defaultValue={topic?.description} error={errors.description} />
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "Сохраняем…" : topic ? "Сохранить тему" : "Создать тему"}
        </button>
        {state.ok && <span role="status" className="text-sm text-emerald-700">Сохранено</span>}
        {state.error && <span role="alert" className="text-sm text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}
