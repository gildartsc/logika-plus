export function PageFallback({ text = "Загрузка…" }: { text?: string }) {
  return (
    <p className="flex items-center gap-2 text-stone-500" role="status">
      <span aria-hidden className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-brand-500" />
      {text}
    </p>
  );
}
