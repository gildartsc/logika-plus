import type { Metadata } from "next";
import { PublicHeader } from "@/components/PublicHeader";
import { signOut } from "@/lib/auth/actions";

export const metadata: Metadata = { title: "Доступ ограничен" };

export default function BlockedPage() {
  return (
    <>
      <PublicHeader />
      <main className="flex flex-1 items-start justify-center px-4 py-10 sm:py-16">
        <div className="w-full max-w-sm card p-6 text-center">
          <h1 className="text-xl font-bold text-ink">Доступ ограничен</h1>
          <p className="mt-3 text-stone-600">
            Аккаунт заблокирован или профиль не найден. Обратитесь к учителю.
          </p>
          <form action={signOut} className="mt-6">
            <button
              type="submit"
              className="w-full rounded-lg border border-stone-300 px-4 py-2 font-medium text-stone-700 hover:bg-stone-100"
            >
              Выйти
            </button>
          </form>
        </div>
      </main>
    </>
  );
}
