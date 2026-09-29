type Props = {
  label: string;
  name: string;
  type: string;
  autoComplete: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | undefined;
  hint?: string;
};

export function TextField({
  label,
  name,
  type,
  autoComplete,
  value,
  onChange,
  error,
  hint,
}: Props) {
  const errorId = `${name}-error`;
  return (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      <input
        id={name}
        name={name}
        type={type}
        autoComplete={autoComplete}
        value={value}
        required
        aria-invalid={error ? "true" : undefined}
        aria-describedby={error ? errorId : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint && !error && <p className="field-hint">{hint}</p>}
      {error && (
        <p id={errorId} className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}
