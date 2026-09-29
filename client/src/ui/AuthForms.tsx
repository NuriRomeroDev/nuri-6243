import { useEffect, useRef, useState, type ReactNode } from "react";
import type {
  FieldErrors,
  LoginValues,
  RegisterValues,
} from "../auth/validation";
import { TextField } from "./TextField";

type FormProps<V> = {
  errors: FieldErrors<V>;
  formError?: string | undefined;
  pending: boolean;
  onSubmit: (values: V) => void;
  onSwitch: () => void;
};

type ShellProps = {
  title: string;
  submitLabel: string;
  switchLabel: string;
  errors: object;
  formError?: string | undefined;
  pending: boolean;
  onSubmit: () => void;
  onSwitch: () => void;
  children: ReactNode;
};

function FormShell({
  title,
  submitLabel,
  switchLabel,
  errors,
  formError,
  pending,
  onSubmit,
  onSwitch,
  children,
}: ShellProps) {
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [errors]);

  return (
    <form
      ref={ref}
      noValidate
      aria-busy={pending}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <h2>{title}</h2>
      {children}
      {formError && (
        <p role="alert" className="form-error">
          {formError}
        </p>
      )}
      <button type="submit" disabled={pending}>
        {submitLabel}
      </button>
      <button type="button" className="link" onClick={onSwitch}>
        {switchLabel}
      </button>
    </form>
  );
}

export function LoginForm({ errors, onSubmit, ...rest }: FormProps<LoginValues>) {
  const [values, setValues] = useState<LoginValues>({ email: "", password: "" });
  const set = (key: keyof LoginValues) => (value: string) =>
    setValues((v) => ({ ...v, [key]: value }));

  return (
    <FormShell
      {...rest}
      errors={errors}
      title="Log in"
      submitLabel="Log in"
      switchLabel="Create a new account"
      onSubmit={() => onSubmit(values)}
    >
      <TextField label="Email" name="email" type="email" autoComplete="email"
        value={values.email} onChange={set("email")} error={errors.email} />
      <TextField label="Password" name="password" type="password"
        autoComplete="current-password" value={values.password}
        onChange={set("password")} error={errors.password} />
    </FormShell>
  );
}

export function RegisterForm({ errors, onSubmit, ...rest }: FormProps<RegisterValues>) {
  const [values, setValues] = useState<RegisterValues>({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const set = (key: keyof RegisterValues) => (value: string) =>
    setValues((v) => ({ ...v, [key]: value }));

  return (
    <FormShell
      {...rest}
      errors={errors}
      title="Create account"
      submitLabel="Create account"
      switchLabel="I already have an account"
      onSubmit={() => onSubmit(values)}
    >
      <TextField label="Full name" name="fullName" type="text"
        autoComplete="name" value={values.fullName}
        onChange={set("fullName")} error={errors.fullName} />
      <TextField label="Email" name="email" type="email" autoComplete="email"
        value={values.email} onChange={set("email")} error={errors.email} />
      <TextField label="Password" name="password" type="password"
        autoComplete="new-password" value={values.password}
        onChange={set("password")} error={errors.password}
        hint="At least 8 characters, with a letter and a number" />
      <TextField label="Confirm password" name="confirmPassword" type="password"
        autoComplete="new-password" value={values.confirmPassword}
        onChange={set("confirmPassword")} error={errors.confirmPassword} />
    </FormShell>
  );
}
