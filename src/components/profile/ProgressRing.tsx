// Circular meter: one ratio against a limit. The fill and its track are two
// steps of the same hue; the numbers are text-colored, not series-colored.
const SIZE = 128;
const STROKE = 14;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function ProgressRing({ done, total }: { done: number; total: number }) {
  const ratio = total > 0 ? Math.min(done / total, 1) : 0;
  const label = `Пройдено ${done} из ${total} тем`;

  return (
    <figure className="flex flex-col items-center">
      <div className="relative" style={{ width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={label}>
          <title>{label}</title>
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            strokeWidth={STROKE}
            className="stroke-brand-100"
          />
          {ratio > 0 && (
            <circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="none"
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={CIRCUMFERENCE * (1 - ratio)}
              transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
              className="stroke-brand-500"
            />
          )}
        </svg>
        <div aria-hidden className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-extrabold text-ink">{done}</span>
          <span className="text-xs text-stone-500">из {total}</span>
        </div>
      </div>
      <figcaption className="mt-2 text-sm font-semibold text-stone-600">тем пройдено</figcaption>
    </figure>
  );
}
