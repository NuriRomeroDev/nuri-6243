import { useEffect, useRef, useState, type ReactNode } from "react";
import type {
  FieldErrors,
  LoginValues,
  RegisterValues,
} from "../auth/validation";
import { ArrowRightIcon, LockIcon, MailIcon, UserIcon } from "./icons";
import { email, personName } from "./masks";
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
  subtitle: string;
  submitLabel: string;
  switchPrompt: string;
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
  subtitle,
  submitLabel,
  switchPrompt,
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
    <>
      <h2>{title}</h2>
      <p className="subtitle">{subtitle}</p>
      <form
        ref={ref}
        noValidate
        aria-busy={pending}
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        {children}
        {formError && (
          <p role="alert" className="form-error">
            {formError}
          </p>
        )}
        <button type="submit" className="primary" disabled={pending}>
          <span>{pending ? "Procesando…" : submitLabel}</span>
          <ArrowRightIcon />
        </button>
      </form>
      <hr className="divider" />
      <p className="switch">
        {switchPrompt}{" "}
        <button type="button" className="link" onClick={onSwitch}>
          {switchLabel}
        </button>
      </p>
    </>
  );
}

export function LoginForm({
  errors,
  onSubmit,
  ...rest
}: FormProps<LoginValues>) {
  const [values, setValues] = useState<LoginValues>({
    email: "",
    password: "",
  });
  const set = (key: keyof LoginValues) => (value: string) =>
    setValues((v) => ({ ...v, [key]: value }));

  return (
    <FormShell
      {...rest}
      errors={errors}
      title="Inicia sesión"
      subtitle="Qué bueno verte de nuevo. Tu caracol te espera en la pista."
      submitLabel="Iniciar sesión"
      switchPrompt="¿No tienes cuenta?"
      switchLabel="Crear cuenta"
      onSubmit={() => onSubmit(values)}
    >
      <TextField
        label="Correo electrónico"
        placeholder="tu@email.com"
        icon={<MailIcon />}
        name="email"
        type="email"
        autoComplete="email"
        value={values.email}
        onChange={(v) => set("email")(email(v))}
        error={errors.email}
      />
      <TextField
        label="Contraseña"
        icon={<LockIcon />}
        name="password"
        type="password"
        autoComplete="current-password"
        value={values.password}
        onChange={set("password")}
        error={errors.password}
      />
    </FormShell>
  );
}

export function RegisterForm({
  errors,
  onSubmit,
  ...rest
}: FormProps<RegisterValues>) {
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
      title="Crea tu cuenta"
      subtitle="Únete al club y comienza tu aventura en las carreras de caracoles."
      submitLabel="Crear cuenta"
      switchPrompt="¿Ya tienes cuenta?"
      switchLabel="Iniciar sesión"
      onSubmit={() => onSubmit(values)}
    >
      <TextField
        label="Nombre completo"
        placeholder="Tu nombre completo"
        icon={<UserIcon />}
        name="fullName"
        type="text"
        autoComplete="name"
        value={values.fullName}
        onChange={(v) => set("fullName")(personName(v))}
        error={errors.fullName}
      />
      <TextField
        label="Correo electrónico"
        placeholder="tu@email.com"
        icon={<MailIcon />}
        name="email"
        type="email"
        autoComplete="email"
        value={values.email}
        onChange={(v) => set("email")(email(v))}
        error={errors.email}
      />
      <TextField
        label="Contraseña"
        icon={<LockIcon />}
        name="password"
        type="password"
        autoComplete="new-password"
        value={values.password}
        onChange={set("password")}
        error={errors.password}
        hint="Mínimo 8 caracteres, con al menos una letra y un número"
      />
      <TextField
        label="Confirmar contraseña"
        icon={<LockIcon />}
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        value={values.confirmPassword}
        onChange={set("confirmPassword")}
        error={errors.confirmPassword}
      />
    </FormShell>
  );
}
