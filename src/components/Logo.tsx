import Link from "next/link";
import { APP_NAME } from "@/config/app";

// A tile with a solid lip, like a game piece.
export function LogoMark() {
  return (
    <span
      aria-hidden
      className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500 text-lg font-extrabold text-white shadow-[0_3px_0_var(--color-brand-700)]"
    >
      Л<span className="text-gold-300">+</span>
    </span>
  );
}

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2.5 rounded-xl text-ink">
      <LogoMark />
      <span className="text-lg font-bold tracking-tight">{APP_NAME}</span>
    </Link>
  );
}
