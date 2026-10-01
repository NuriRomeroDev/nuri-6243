import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { App } from "./App";

vi.mock("./auth/password", async (importOriginal) => {
  const real = await importOriginal<typeof import("./auth/password")>();
  return { ...real, hashPassword: (pw: string) => real.hashPassword(pw, 1) };
});

const click = (name: string) =>
  fireEvent.click(screen.getByRole("button", { name }));
const fill = (fields: Record<string, string>) => {
  for (const [label, value] of Object.entries(fields))
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
};
const creds = {
  "Correo electrónico": "ada@example.com",
  Contraseña: "secret123",
};
const account = {
  "Nombre completo": "Ada Lovelace",
  ...creds,
  "Confirmar contraseña": "secret123",
};

async function registerAda() {
  click("Crear cuenta");
  fill(account);
  click("Crear cuenta");
  await screen.findByText(/Hola, Ada/);
}

it("shows the auth screen without a session", () => {
  render(<App />);
  expect(screen.getByRole("heading", { name: "Snail Club" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Iniciar sesión" })).toBeVisible();
});

it("shows accessible field errors and focuses the first invalid field", () => {
  render(<App />);
  click("Crear cuenta");
  click("Crear cuenta");
  for (const label of ["Nombre completo", "Correo electrónico", "Contraseña"]) {
    const input = screen.getByLabelText(label);
    expect(input).toHaveAttribute("aria-invalid", "true");
    const errorId =
      input.getAttribute("aria-describedby")?.split(" ").pop() ?? "";
    expect(document.getElementById(errorId)).toHaveTextContent(/\S/);
  }
  expect(screen.getByLabelText("Nombre completo")).toHaveFocus();
});

it("links the password hint to the input", () => {
  render(<App />);
  click("Crear cuenta");
  const hintId = screen
    .getByLabelText("Contraseña", { selector: "input" })
    .getAttribute("aria-describedby");
  expect(document.getElementById(hintId ?? "")).toHaveTextContent(
    "Mínimo 8 caracteres",
  );
});

it("registers, logs out, logs in and stays logged in after a remount", async () => {
  const { unmount } = render(<App />);
  await registerAda();
  expect(screen.getByText("$0.00")).toBeVisible();

  click("Cerrar sesión");
  fill(creds);
  click("Iniciar sesión");
  await screen.findByText(/Hola, Ada/);

  unmount();
  render(<App />);
  expect(screen.getByText(/Hola, Ada/)).toBeVisible();
});

it("shows a generic alert for a wrong password", async () => {
  render(<App />);
  await registerAda();
  click("Cerrar sesión");
  fill({ ...creds, Contraseña: "wrong-pass1" });
  click("Iniciar sesión");
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Correo o contraseña inválidos",
  );
});

it("shows a field error for a duplicate email", async () => {
  render(<App />);
  await registerAda();
  click("Cerrar sesión");
  click("Crear cuenta");
  fill(account);
  click("Crear cuenta");
  await screen.findByText("Ya existe una cuenta con este correo");
  expect(screen.getByLabelText("Correo electrónico")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
});

it("shows a generic error when storage fails", async () => {
  render(<App />);
  click("Crear cuenta");
  fill(account);
  vi.spyOn(Storage.prototype, "setItem").mockImplementationOnce(() => {
    throw new Error("quota");
  });
  click("Crear cuenta");
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "No pudimos guardar tus datos",
  );
});

it("toggles password visibility with an accessible button", () => {
  render(<App />);
  const input = screen.getByLabelText("Contraseña", { selector: "input" });
  expect(input).toHaveAttribute("type", "password");
  const show = screen.getByRole("button", { name: "Mostrar contraseña" });
  expect(show).toHaveAttribute("aria-pressed", "false");
  fireEvent.click(show);
  expect(input).toHaveAttribute("type", "text");
  const hide = screen.getByRole("button", { name: "Ocultar contraseña" });
  expect(hide).toHaveAttribute("aria-pressed", "true");
  expect(hide).toHaveAttribute("aria-controls", input.id);
});
