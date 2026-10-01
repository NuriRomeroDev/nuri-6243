import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { User } from "../auth/auth";
import { TopUpDialog } from "./TopUpDialog";

const user: User = {
  id: "u1",
  fullName: "Ada Lovelace",
  email: "ada@example.com",
  balanceCents: 0,
  createdAt: "2026-01-01T00:00:00.000Z",
};
const envelope = (status: string, detail: string, extra = {}) => ({
  id: "t1",
  status,
  status_detail: detail,
  transaction_amount: 500,
  date_created: "2026-01-01T00:00:00.000Z",
  authorization_code: status === "approved" ? "654321" : null,
  reference: "SNP-20260101-000001",
  payer_id: "u1",
  payer_email: "ada@example.com",
  card_number: "1234123412341234",
  cvv: "543",
  ...extra,
});
const reply = (httpStatus: number, body: unknown) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status: httpStatus }));

const fill = (over: Record<string, string> = {}) => {
  const values = {
    "Número de tarjeta": "1234 1234 1234 1234",
    Vencimiento: "12/26",
    CVV: "543",
    "Nombre del titular": "Ada Lovelace",
    "Monto a cargar": "500",
    ...over,
  };
  for (const [label, value] of Object.entries(values))
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
};
const submit = () =>
  fireEvent.click(screen.getByRole("button", { name: /Pagar con SnailPay/ }));

function setup(fetchImpl: typeof fetch, extra = {}) {
  const onCharge = vi.fn();
  const onClose = vi.fn();
  render(
    <TopUpDialog
      user={user}
      onCharge={onCharge}
      onClose={onClose}
      fetchImpl={fetchImpl}
      {...extra}
    />,
  );
  return { onCharge, onClose };
}

afterEach(() => vi.useRealTimers());

it("moves focus into the dialog while processing", () => {
  setup(vi.fn(() => new Promise<Response>(() => {})));
  fill();
  submit();
  expect(screen.getByRole("heading", { name: "Procesando…" })).toHaveFocus();
});

it("opens as an accessible modal with the first field focused", () => {
  setup(reply(201, {}));
  expect(
    screen.getByRole("dialog", { name: "Cargar saldo con SnailPay" }),
  ).toBeVisible();
  expect(screen.getByLabelText("Número de tarjeta")).toHaveFocus();
  expect(screen.getByText("Tarjetas de prueba")).toBeInTheDocument();
});

it("blocks submit and shows field errors when the form is invalid", () => {
  const fetchImpl = reply(201, {});
  setup(fetchImpl);
  fill({ "Número de tarjeta": "123", "Monto a cargar": "10001" });
  submit();
  expect(fetchImpl).not.toHaveBeenCalled();
  expect(screen.getByLabelText("Número de tarjeta")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  expect(screen.getByLabelText("Monto a cargar")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  expect(screen.getByLabelText("Número de tarjeta")).toHaveFocus();
});

it("approves: sends a clean payload, records the charge and shows the code", async () => {
  const fetchImpl = reply(201, envelope("approved", "accredited"));
  const { onCharge, onClose } = setup(fetchImpl);
  fill();
  submit();
  expect(
    screen.getByText(/Estamos validando tu pago con SnailPay/),
  ).toBeVisible();
  const heading = await screen.findByRole("heading", { name: "Pago aprobado" });
  await waitFor(() => expect(heading).toHaveFocus());
  expect(screen.getByText("654321")).toBeVisible();
  expect(screen.getByText("$500.00")).toBeVisible();
  const body = JSON.parse(
    (fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1]
      .body as string,
  );
  expect(body).toMatchObject({
    card_number: "1234123412341234",
    amount: 500,
    payer_id: "u1",
    payer_email: "ada@example.com",
  });
  expect(onCharge).toHaveBeenCalledWith(
    expect.objectContaining({
      kind: "approved",
      response: expect.objectContaining({ id: "t1" }),
    }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Listo" }));
  expect(onClose).toHaveBeenCalled();
});

it("does not allow cancelling while processing", async () => {
  setup(vi.fn(() => new Promise<Response>(() => {})));
  fill();
  submit();
  const dialog = screen.getByRole("dialog");
  const cancel = new Event("cancel", { cancelable: true });
  dialog.dispatchEvent(cancel);
  expect(cancel.defaultPrevented).toBe(true);
  expect(screen.queryByRole("button", { name: "Cerrar ventana" })).toBeNull();
  expect(screen.getByRole("status")).toHaveTextContent("Procesando");
});

it("rejected: shows the reason, records it and retry clears the CVV", async () => {
  const fetchImpl = reply(
    402,
    envelope("rejected", "cc_rejected_insufficient_amount"),
  );
  const { onCharge } = setup(fetchImpl);
  fill();
  submit();
  await screen.findByRole("heading", { name: "Tarjeta rechazada" });
  expect(screen.getByText("Fondos insuficientes en la tarjeta.")).toBeVisible();
  expect(onCharge).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole("button", { name: "Intentar de nuevo" }));
  expect(screen.getByLabelText("CVV")).toHaveValue("");
  expect(screen.getByLabelText("Número de tarjeta")).toHaveValue(
    "1234 1234 1234 1234",
  );
});

it("unavailable: shows the outage copy", async () => {
  setup(reply(503, envelope("error", "service_unavailable")));
  fill();
  submit();
  await screen.findByRole("heading", { name: "SnailPay no está disponible" });
  expect(screen.getByText(/Por favor, intenta más tarde/)).toBeVisible();
});

it("network failure shows the connection copy", async () => {
  setup(vi.fn(async () => Promise.reject(new TypeError("offline"))));
  fill();
  submit();
  expect(
    await screen.findByText(/No pudimos conectar con SnailPay/),
  ).toBeVisible();
});

it("timeout: shows the copy and Reintentar resubmits the same data", async () => {
  const fetchImpl = vi
    .fn()
    .mockImplementationOnce(
      (_url: string, init: RequestInit) =>
        new Promise((_res, rej) =>
          init.signal?.addEventListener("abort", () =>
            rej(new DOMException("aborted", "AbortError")),
          ),
        ),
    )
    .mockImplementation(
      async () =>
        new Response(JSON.stringify(envelope("approved", "accredited")), {
          status: 201,
        }),
    );
  setup(fetchImpl, { timeoutMs: 20 });
  fill();
  submit();
  await screen.findByRole("heading", { name: "La operación tardó demasiado" });
  expect(
    screen.getByText(
      "No pudimos confirmar el pago. No se aplicó ningún cargo a tu saldo. Puedes intentar nuevamente.",
    ),
  ).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
  await screen.findByRole("heading", { name: "Pago aprobado" });
  expect(fetchImpl).toHaveBeenCalledTimes(2);
  const [a, b] = fetchImpl.mock.calls.map((c) => c[1].body);
  expect(a).toBe(b);
});

it("422 returns to the form with the matching field error", async () => {
  const { onCharge } = setup(
    reply(422, envelope("rejected", "cc_rejected_bad_filled_security_code")),
  );
  fill();
  submit();
  await waitFor(() =>
    expect(screen.getByLabelText("CVV")).toHaveAttribute(
      "aria-invalid",
      "true",
    ),
  );
  // Focus moves in a passive effect, so it may land just after the DOM update.
  await waitFor(() => expect(screen.getByLabelText("CVV")).toHaveFocus());
  expect(onCharge).toHaveBeenCalledOnce();
});

it("a 200 approved-shaped body is unavailable and never flagged as approved", async () => {
  const { onCharge } = setup(reply(200, envelope("approved", "accredited")));
  fill();
  submit();
  await screen.findByRole("heading", { name: "SnailPay no está disponible" });
  expect(onCharge).toHaveBeenCalledWith(
    expect.objectContaining({ kind: "unavailable" }),
  );
});

it.each([
  ["Vencimiento", "12ab26", "12/26"],
  ["Monto a cargar", "ab1c2", "12"],
  ["Número de tarjeta", "4000000000000002", "4000 0000 0000 0002"],
  ["CVV", "12a3", "123"],
  ["Nombre del titular", "Ada2 Lovelace!", "Ada Lovelace"],
])("masks %s as the user types", (label, typed, shown) => {
  setup(reply(201, {}));
  fireEvent.change(screen.getByLabelText(label), { target: { value: typed } });
  expect(screen.getByLabelText(label)).toHaveValue(shown);
});

it("limits input length with maxLength attributes", () => {
  setup(reply(201, {}));
  for (const [label, max] of [
    ["Número de tarjeta", "19"],
    ["Vencimiento", "5"],
    ["CVV", "3"],
    ["Monto a cargar", "9"],
  ])
    expect(screen.getByLabelText(label)).toHaveAttribute("maxlength", max);
});

it("submits 16 digits when the card is typed without spaces", async () => {
  const fetchImpl = reply(201, envelope("approved", "accredited"));
  setup(fetchImpl);
  fill({ "Número de tarjeta": "1234123412341234" });
  submit();
  await screen.findByRole("heading", { name: "Pago aprobado" });
  const body = JSON.parse(
    (fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1]
      .body as string,
  );
  expect(body.card_number).toBe("1234123412341234");
});
