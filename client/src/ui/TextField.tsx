import { useState, type ReactNode } from "react";
import { EyeIcon, EyeOffIcon } from "./icons";

type Props = {
  label: string;
  name: string;
  type: string;
  autoComplete: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | undefined;
  hint?: string;
  placeholder?: string;
  inputMode?: "numeric" | "decimal";
  maxLength?: number;
  icon?: ReactNode;
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
  placeholder,
  inputMode,
  maxLength,
  icon,
}: Props) {
  const [visible, setVisible] = useState(false);
  const isPassword = type === "password";
  const errorId = `${name}-error`;
  const hintId = `${name}-hint`;
  const describedBy =
    [hint && hintId, error && errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      <div className="input-wrap">
        {icon && <span className="input-icon">{icon}</span>}
        <input
          id={name}
          name={name}
          type={isPassword && visible ? "text" : type}
          autoComplete={autoComplete}
          placeholder={placeholder}
          inputMode={inputMode}
          maxLength={maxLength}
          value={value}
          required
          aria-invalid={error ? "true" : undefined}
          aria-describedby={describedBy}
          onChange={(e) => onChange(e.target.value)}
        />
        {isPassword && (
          <button
            type="button"
            className="toggle"
            aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
            aria-pressed={visible}
            aria-controls={name}
            onClick={() => setVisible((v) => !v)}
          >
            {visible ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        )}
      </div>
      {hint && (
        <p id={hintId} className="field-hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}
