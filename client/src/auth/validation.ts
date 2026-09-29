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
    errors.fullName = "Enter your name (2-100 characters)";
  if (!EMAIL_RE.test(email) || email.length > 254)
    errors.email = "Enter a valid email address";
  if (v.password.length < 8 || v.password.length > 128)
    errors.password = "Use 8-128 characters";
  else if (!/[A-Za-z]/.test(v.password) || !/\d/.test(v.password))
    errors.password = "Include at least one letter and one number";
  if (v.confirmPassword !== v.password)
    errors.confirmPassword = "Passwords do not match";
  return errors;
}

export function validateLogin(v: LoginValues): FieldErrors<LoginValues> {
  const errors: FieldErrors<LoginValues> = {};
  if (!v.email.trim()) errors.email = "Enter your email";
  if (!v.password) errors.password = "Enter your password";
  return errors;
}
