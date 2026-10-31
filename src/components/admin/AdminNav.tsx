"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin", label: "Дашборд" },
  { href: "/admin/topics", label: "Темы и задачи" },
  { href: "/admin/students", label: "Ученики" },
  { href: "/admin/invites", label: "Приглашения" },
  { href: "/admin/files", label: "Файлы" },
  { href: "/admin/export", label: "Экспорт" },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Разделы админ-панели" className="-mx-4 mb-6 overflow-x-auto px-4">
      <ul className="flex gap-1 border-b border-stone-200">
        {LINKS.map((link) => {
          const active = link.href === "/admin" ? pathname === "/admin" : pathname.startsWith(link.href);
          return (
            <li key={link.href} className="shrink-0">
              <Link
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`-mb-px block border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap ${
                  active ? "border-brand-600 text-brand-700" : "border-transparent text-stone-600 hover:text-ink"
                }`}
              >
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
