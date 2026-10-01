import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { User } from "../auth/auth";
import { Dashboard } from "./Dashboard";
import { simulateDay } from "./stats";

const user: User = {
  id: "user-1",
  fullName: "Ada Lovelace",
  email: "ada@example.com",
  balanceCents: 0,
  createdAt: "2026-01-01T00:00:00.000Z",
};

const setup = (props: Partial<Parameters<typeof Dashboard>[0]> = {}) =>
  render(<Dashboard user={user} onLogout={() => {}} {...props} />);

it("greets the user by first name and shows the balance", () => {
  setup();
  expect(screen.getByText(/Hola, Ada/)).toBeVisible();
  expect(screen.queryByText(/Lovelace/)).toBeNull();
  expect(screen.getByText("$0.00")).toBeVisible();
  expect(screen.getByText("Listo para nuevas apuestas")).toBeVisible();
});

it("calls onLogout from the header button", () => {
  const onLogout = vi.fn();
  setup({ onLogout });
  fireEvent.click(screen.getByRole("button", { name: "Cerrar sesión" }));
  expect(onLogout).toHaveBeenCalledOnce();
});

it("calls onTopUp, and disables the button when there is no handler", () => {
  const onTopUp = vi.fn();
  const { unmount } = setup({ onTopUp });
  fireEvent.click(screen.getByRole("button", { name: /Cargar saldo/ }));
  expect(onTopUp).toHaveBeenCalledOnce();
  unmount();
  setup();
  const button = screen.getByRole("button", { name: /Cargar saldo/ });
  expect(button).toBeDisabled();
  expect(button).toHaveAttribute("title", "Disponible pronto");
});

it("shows the simulated bets with percentages", () => {
  setup();
  const { won, lost } = simulateDay(user.id, new Date()).bets;
  const total = won + lost;
  const figure = screen.getByRole("figure", {
    name: "Apuestas ganadas y perdidas",
  });
  expect(within(figure).getByText(`${won} ganadas`)).toBeVisible();
  expect(within(figure).getByText(`${lost} perdidas`)).toBeVisible();
  expect(
    within(figure).getByText(`${((won / total) * 100).toFixed(1)}%`),
  ).toBeVisible();
  expect(within(figure).getByText("Total").previousSibling).toHaveTextContent(
    String(total),
  );
});

it("lists the six snails and six simulated wins in an accessible table", () => {
  setup();
  const figure = screen.getByRole("figure", { name: "Victorias por caracol" });
  const rows = within(within(figure).getByRole("table")).getAllByRole("row");
  const body = rows.slice(1);
  expect(body).toHaveLength(6);
  const sum = body.reduce(
    (acc, row) => acc + Number(within(row).getAllByRole("cell")[1].textContent),
    0,
  );
  expect(sum).toBe(6);
  expect(screen.getByText("6 carreras simuladas hoy")).toBeVisible();
});
