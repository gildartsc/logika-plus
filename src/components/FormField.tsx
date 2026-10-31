type FormFieldProps = {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
  maxLength?: number;
  minLength?: number;
  defaultValue?: string;
  errors?: string[];
  placeholder?: string;
};

export function FormField({ label, name, errors, ...inputProps }: FormFieldProps) {
  const errorId = `${name}-error`;
  const hasError = Boolean(errors?.length);

  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-ink">{label}</span>
      <input
        name={name}
        required
        aria-invalid={hasError}
        aria-describedby={hasError ? errorId : undefined}
        className="field"
        {...inputProps}
      />
      {hasError && (
        <span id={errorId} className="mt-1 block text-sm text-red-600">
          {errors?.[0]}
        </span>
      )}
    </label>
  );
}
