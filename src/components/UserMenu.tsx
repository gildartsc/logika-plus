"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { signOut } from "@/lib/auth/actions";

const ITEM = "block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-ink hover:bg-brand-50";

export function UserMenu({ isAdmin }: { isAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label="Меню"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
        className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-line bg-white text-xl leading-none text-ink hover:bg-brand-50"
      >
        ⋮
      </button>
      {open && (
        <div
          role="menu"
          className="card absolute right-0 z-20 mt-2 w-56 animate-rise p-1.5"
        >
          <Link role="menuitem" href="/profile" className={ITEM} onClick={close}>
            Личный кабинет
          </Link>
          {isAdmin && (
            <Link role="menuitem" href="/admin" className={ITEM} onClick={close}>
              Админ-панель
            </Link>
          )}
          <Link role="menuitem" href="/about" className={ITEM} onClick={close}>
            О нас
          </Link>
          <Link role="menuitem" href="/contacts" className={ITEM} onClick={close}>
            Контакты
          </Link>
          <form action={signOut} className="mt-1 border-t-2 border-line pt-1">
            <button role="menuitem" type="submit" className={`${ITEM} text-red-600`}>
              Выйти
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
