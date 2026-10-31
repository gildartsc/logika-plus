type Props = {
  label: string;
  name: string;
  defaultValue?: string | number;
  error?: string;
  hint?: string;
  rows?: number;
  type?: string;
  maxLength?: number;
};

// Text input or textarea (when rows is set) with a label, hint and error.
export function Field({ label, name, defaultValue, error, hint, rows, type = "text", maxLength }: Props) {
  const id = `field-${name}`;
  const className = "field";
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-ink">
        {label}
      </label>
      {rows ? (
        <textarea id={id} name={name} rows={rows} maxLength={maxLength} defaultValue={defaultValue} aria-invalid={Boolean(error)} aria-describedby={describedBy} className={className} />
      ) : (
        <input id={id} name={name} type={type} maxLength={maxLength} defaultValue={defaultValue} aria-invalid={Boolean(error)} aria-describedby={describedBy} className={className} />
      )}
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1 text-xs text-stone-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
