// Initials avatar: no photos are collected (SPEC section 7).
const PALETTE = [
  "bg-brand-100 text-brand-800",
  "bg-emerald-100 text-emerald-800",
  "bg-amber-100 text-amber-800",
  "bg-sky-100 text-sky-800",
  "bg-rose-100 text-rose-800",
  "bg-violet-100 text-violet-800",
];

function colorFor(id: string): string {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

export function Avatar({ id, name }: { id: string; name: string }) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <span
      aria-hidden
      className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-3xl font-extrabold ring-4 ring-white ${colorFor(id)}`}
    >
      {initial}
    </span>
  );
}
