export type RegisterValues = {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
};
export type LoginValues = { email: string; password: string };
export type FieldErrors<T> = Partial<Record<keyof T, string>>;

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export function validateRegister(
  v: RegisterValues,
): FieldErrors<RegisterValues> {
  const errors: FieldErrors<RegisterValues> = {};
  const name = v.fullName.trim();
  const email = normalizeEmail(v.email);
  if (name.length < 2 || name.length > 100)
    errors.fullName = "Ingresa tu nombre (2 a 100 caracteres)";
  if (!EMAIL_RE.test(email) || email.length > 254)
    errors.email = "Ingresa un correo válido";
  if (v.password.length < 8 || v.password.length > 128)
    errors.password = "Usa entre 8 y 128 caracteres";
  else if (!/[A-Za-z]/.test(v.password) || !/\d/.test(v.password))
    errors.password = "Incluye al menos una letra y un número";
  if (v.confirmPassword !== v.password)
    errors.confirmPassword = "Las contraseñas no coinciden";
  return errors;
}

export function validateLogin(v: LoginValues): FieldErrors<LoginValues> {
  const errors: FieldErrors<LoginValues> = {};
  if (!v.email.trim()) errors.email = "Ingresa tu correo";
  if (!v.password) errors.password = "Ingresa tu contraseña";
  return errors;
}
