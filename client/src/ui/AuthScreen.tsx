import { useState } from "react";
import type { AuthResult } from "../auth/auth";
import {
  validateLogin,
  validateRegister,
  type FieldErrors,
  type LoginValues,
  type RegisterValues,
} from "../auth/validation";
import { LoginForm, RegisterForm } from "./AuthForms";

type Props = {
  onRegister: (input: Omit<RegisterValues, "confirmPassword">) => Promise<AuthResult>;
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
        setFieldErrors({ email: "An account with this email already exists" });
      else setFormError("Invalid email or password");
    } catch {
      setFormError("Could not save your data. Check browser storage and try again.");
    } finally {
      setPending(false);
    }
  }

  const shared = { pending, formError, onSwitch: switchMode };

  return mode === "login" ? (
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
          onRegister({ fullName: v.fullName, email: v.email, password: v.password }),
        )
      }
    />
  );
}
