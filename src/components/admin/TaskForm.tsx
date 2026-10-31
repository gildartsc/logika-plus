"use client";

import { startTransition, useActionState, useState } from "react";
import { Markdown } from "@/components/learn/Markdown";
import { saveTask, type FormState } from "@/lib/admin/actions";
import { Field } from "./Field";

export type TaskFormValues = {
  public_text: string;
  ai_context: string;
  grading_criteria: string;
  common_mistakes: string;
  hint_1: string;
  hint_2: string;
  hint_3: string;
};

type Props = {
  topicId: string;
  type: "critical" | "engineering";
  values: TaskFormValues | null;
};

export function TaskForm({ topicId, type, values }: Props) {
  const [state, action, pending] = useActionState(saveTask.bind(null, topicId), {} as FormState);
  const [text, setText] = useState(values?.public_text ?? "");
  const [preview, setPreview] = useState(false);
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
      <input type="hidden" name="type" value={type} />

      <div>
        <div className="mb-1 flex items-center justify-between gap-2">
          <label htmlFor={`text-${type}`} className="text-sm font-medium text-stone-700">
            Текст для ученика (Markdown)
          </label>
          <button type="button" onClick={() => setPreview((v) => !v)} className="text-sm font-medium text-brand-600 hover:underline">
            {preview ? "Редактировать" : "Предпросмотр"}
          </button>
        </div>
        {preview ? (
          <div className="min-h-40 rounded-lg border border-stone-200 bg-stone-50 p-4">
            <Markdown>{text || "_Пусто_"}</Markdown>
          </div>
        ) : (
          <textarea
            id={`text-${type}`}
            name="public_text"
            rows={10}
            maxLength={10000}
            value={text}
            onChange={(e) => setText(e.target.value)}
            aria-invalid={Boolean(errors.public_text)}
            className="w-full rounded-lg border border-stone-300 px-3 py-2 font-mono text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200 aria-invalid:border-red-500"
          />
        )}
        {preview && <input type="hidden" name="public_text" value={text} />}
        <p className="mt-1 text-xs text-stone-500">
          **жирный**, списки через «- », таблицы через «|». Картинка по ссылке: ![подпись](https://адрес/картинки.png)
        </p>
        {errors.public_text && <p className="mt-1 text-sm text-red-600">{errors.public_text}</p>}
      </div>

      <Field
        label="Контекст для ИИ (коротко, ученик не видит)"
        name="ai_context"
        rows={2}
        maxLength={1500}
        defaultValue={values?.ai_context}
        error={errors.ai_context}
      />
      <Field
        label="Критерии хорошего решения (по одному на строку, ученик не видит)"
        name="grading_criteria"
        rows={5}
        defaultValue={values?.grading_criteria}
        error={errors.grading_criteria}
        hint="Контрольные точки вида «Ученик учёл…», а не готовый ответ."
      />
      <Field
        label="Типичные ошибки (по одной на строку, ученик не видит)"
        name="common_mistakes"
        rows={3}
        defaultValue={values?.common_mistakes}
        error={errors.common_mistakes}
      />
      {([1, 2, 3] as const).map((n) => (
        <Field
          key={n}
          label={`Подсказка ${n}`}
          name={`hint_${n}`}
          rows={2}
          maxLength={1000}
          defaultValue={values?.[`hint_${n}`]}
          error={errors[`hint_${n}`]}
        />
      ))}

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "Сохраняем…" : "Сохранить задачу"}
        </button>
        {state.ok && <span role="status" className="text-sm text-emerald-700">Сохранено</span>}
        {state.error && <span role="alert" className="text-sm text-red-600">{state.error}</span>}
        {Object.keys(errors).length > 0 && <span role="alert" className="text-sm text-red-600">Исправьте поля с ошибками</span>}
      </div>
    </form>
  );
}
