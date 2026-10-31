import Link from "next/link";
import { Logo } from "./Logo";

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-10 border-b-2 border-line bg-paper/90 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <Logo />
        <nav className="flex items-center gap-2">
          <Link href="/login" className="rounded-xl px-3 py-2 text-sm font-semibold text-ink hover:bg-white">
            Вход
          </Link>
          <Link href="/register" className="btn-primary px-3 py-2 text-sm">
            Регистрация
          </Link>
        </nav>
      </div>
    </header>
  );
}
