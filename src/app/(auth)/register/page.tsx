import type { Metadata } from "next";
import { RegisterForm } from "@/components/AuthForms";

export const metadata: Metadata = { title: "Регистрация" };

export default function RegisterPage() {
  return (
    <>
      <h1 className="mb-6 text-2xl font-extrabold text-ink">Регистрация</h1>
      <RegisterForm />
    </>
  );
}
