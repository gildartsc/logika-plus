import type { Metadata } from "next";
import { LoginForm } from "@/components/AuthForms";

export const metadata: Metadata = { title: "Вход" };

export default function LoginPage() {
  return (
    <>
      <h1 className="mb-6 text-2xl font-extrabold text-ink">Вход</h1>
      <LoginForm />
    </>
  );
}
