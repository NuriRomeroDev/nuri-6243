import { useState } from "react";
import type { AuthResult } from "../auth/auth";
import {
  validateLogin,
  validateRegister,
  type FieldErrors,
  type LoginValues,
  type RegisterValues,
} from "../auth/validation";
import { Brand } from "./icons";
import { LoginForm, RegisterForm } from "./AuthForms";

type Props = {
  onRegister: (
    input: Omit<RegisterValues, "confirmPassword">,
  ) => Promise<AuthResult>;
  onLogin: (email: string, password: string) => Promise<AuthResult>;
};

type Errors = FieldErrors<RegisterValues>;

export function AuthScreen({ onRegister, onLogin }: Props) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [pending, setPending] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string>();

  const switchMode = () => {
    setMode(mode === "login" ? "register" : "login");
    setFieldErrors({});
    setFormError(undefined);
  };

  async function submit(errors: Errors, run: () => Promise<AuthResult>) {
    setFormError(undefined);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setPending(true);
    try {
      const result = await run();
      if (result.ok) return;
      if (result.error === "EMAIL_TAKEN")
        setFieldErrors({ email: "Ya existe una cuenta con este correo" });
      else setFormError("Correo o contraseña inválidos");
    } catch {
      setFormError(
        "No pudimos guardar tus datos. Revisa el almacenamiento del navegador e inténtalo de nuevo.",
      );
    } finally {
      setPending(false);
    }
  }

  const shared = { pending, formError, onSwitch: switchMode };

  const form =
    mode === "login" ? (
      <LoginForm
        {...shared}
        errors={fieldErrors}
        onSubmit={(v: LoginValues) =>
          void submit(validateLogin(v), () => onLogin(v.email, v.password))
        }
      />
    ) : (
      <RegisterForm
        {...shared}
        errors={fieldErrors}
        onSubmit={(v) =>
          void submit(validateRegister(v), () =>
            onRegister({
              fullName: v.fullName,
              email: v.email,
              password: v.password,
            }),
          )
        }
      />
    );
  return (
    <section className="auth-card">
      <div className="auth-panel">
        <Brand />
        {form}
      </div>
      <div className="auth-hero" aria-hidden="true" />
    </section>
  );
}
