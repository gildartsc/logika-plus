"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signIn, signUp, type AuthFormState } from "@/lib/auth/actions";
import {
  CLASS_MAX,
  NAME_MAX,
  PASSWORD_MAX,
  PASSWORD_MIN,
} from "@/lib/auth/validation";
import { FormField } from "./FormField";

const initialState: AuthFormState = {};

export function LoginForm() {
  const [state, action, pending] = useActionState(signIn, initialState);

  return (
    <form action={action} className="space-y-4" noValidate>
      <FormField
        label="E-mail"
        name="email"
        type="email"
        autoComplete="email"
        maxLength={254}
        defaultValue={state.values?.email}
        errors={state.fieldErrors?.email}
      />
      <FormField
        label="Пароль"
        name="password"
        type="password"
        autoComplete="current-password"
        maxLength={PASSWORD_MAX}
        errors={state.fieldErrors?.password}
      />
      <FormMessages state={state} />
      <SubmitButton pending={pending} label="Войти" />
      <p className="text-center text-sm text-stone-600">
        Нет аккаунта?{" "}
        <Link href="/register" className="font-semibold text-brand-600 hover:underline">
          Зарегистрироваться
        </Link>
      </p>
    </form>
  );
}

export function RegisterForm() {
  const [state, action, pending] = useActionState(signUp, initialState);

  if (state.notice) {
    return <p className="rounded-xl border-2 border-emerald-200 bg-emerald-50 p-4 text-emerald-800">{state.notice}</p>;
  }

  return (
    <form action={action} className="space-y-4" noValidate>
      <FormField
        label="Код приглашения от учителя"
        name="inviteCode"
        placeholder="Например, K7M2-QX9P"
        autoComplete="off"
        maxLength={20}
        defaultValue={state.values?.inviteCode}
        errors={state.fieldErrors?.inviteCode}
      />
      <FormField
        label="Имя или псевдоним"
        name="name"
        autoComplete="nickname"
        maxLength={NAME_MAX}
        defaultValue={state.values?.name}
        errors={state.fieldErrors?.name}
      />
      <FormField
        label="Класс"
        name="className"
        placeholder="Например, 9А"
        maxLength={CLASS_MAX}
        defaultValue={state.values?.className}
        errors={state.fieldErrors?.className}
      />
      <FormField
        label="E-mail"
        name="email"
        type="email"
        autoComplete="email"
        maxLength={254}
        defaultValue={state.values?.email}
        errors={state.fieldErrors?.email}
      />
      <FormField
        label={`Пароль (не меньше ${PASSWORD_MIN} символов)`}
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={PASSWORD_MIN}
        maxLength={PASSWORD_MAX}
        errors={state.fieldErrors?.password}
      />
      <p className="text-xs text-stone-500">
        Не указывайте фамилию, телефон и адрес: для работы на платформе они не нужны.
      </p>
      <FormMessages state={state} />
      <SubmitButton pending={pending} label="Зарегистрироваться" />
      <p className="text-center text-sm text-stone-600">
        Уже есть аккаунт?{" "}
        <Link href="/login" className="font-semibold text-brand-600 hover:underline">
          Войти
        </Link>
      </p>
    </form>
  );
}

function FormMessages({ state }: { state: AuthFormState }) {
  if (!state.error) return null;
  return (
    <p role="alert" className="rounded-xl border-2 border-red-200 bg-red-50 p-3 text-sm text-red-700">
      {state.error}
    </p>
  );
}

function SubmitButton({ pending, label }: { pending: boolean; label: string }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="btn-primary w-full py-3"
    >
      {pending ? "Подождите…" : label}
    </button>
  );
}
