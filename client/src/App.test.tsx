import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { App } from "./App";
import { TRANSACTIONS_KEY } from "./auth/auth";

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

const chargeResponse = (status: string, detail: string) => ({
  id: "t1",
  status,
  status_detail: detail,
  transaction_amount: 25.5,
  date_created: "2026-01-01T00:00:00.000Z",
  authorization_code: status === "approved" ? "111222" : null,
  reference: "SNP-20260101-000001",
  payer_id: "x",
  payer_email: "ada@example.com",
  card_number: "1234123412341234",
  cvv: "543",
});
const topUp = (httpStatus: number, body: unknown) => {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () => new Response(JSON.stringify(body), { status: httpStatus }),
    ),
  );
  fireEvent.click(screen.getByRole("button", { name: /Cargar saldo/ }));
  fill({
    "Número de tarjeta": "1234123412341234",
    Vencimiento: "12/26",
    CVV: "543",
    "Nombre del titular": "Ada Lovelace",
    "Monto a cargar": "25.50",
  });
  click("Pagar con SnailPay");
};

it("top-up: an approved charge updates the balance and stores the transaction", async () => {
  render(<App />);
  await registerAda();
  topUp(201, chargeResponse("approved", "accredited"));
  await screen.findByRole("heading", { name: "Pago aprobado" });
  click("Listo");
  expect(screen.getByText("$25.50")).toBeVisible();
  const stored = Object.values(
    JSON.parse(localStorage.getItem(TRANSACTIONS_KEY) ?? "{}"),
  )[0] as { card_number: string; cvv: string }[];
  expect(stored[0]).toMatchObject({
    card_number: "1234123412341234",
    cvv: "543",
  });
});

it("top-up: a rejected charge leaves the balance unchanged", async () => {
  render(<App />);
  await registerAda();
  topUp(402, chargeResponse("rejected", "cc_rejected_card_declined"));
  await screen.findByRole("heading", { name: "Tarjeta rechazada" });
  click("Cerrar ventana");
  expect(screen.getByText("$0.00")).toBeVisible();
});

it("top-up: a 200 approved-shaped body does not credit but is stored", async () => {
  render(<App />);
  await registerAda();
  topUp(200, chargeResponse("approved", "accredited"));
  await screen.findByRole("heading", { name: "SnailPay no está disponible" });
  click("Entendido");
  expect(screen.getByText("$0.00")).toBeVisible();
  const stored = Object.values(
    JSON.parse(localStorage.getItem(TRANSACTIONS_KEY) ?? "{}"),
  )[0] as unknown[];
  expect(stored).toHaveLength(1);
});
