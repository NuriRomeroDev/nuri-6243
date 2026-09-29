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
const creds = { Email: "ada@example.com", Password: "secret123" };
const account = {
  "Full name": "Ada Lovelace",
  ...creds,
  "Confirm password": "secret123",
};

async function registerAda() {
  click("Create a new account");
  fill(account);
  click("Create account");
  await screen.findByText("Welcome, Ada Lovelace");
}

it("shows the auth screen without a session", () => {
  render(<App />);
  expect(screen.getByRole("heading", { name: "Snail Racing" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Log in" })).toBeVisible();
});

it("shows accessible field errors and focuses the first invalid field", () => {
  render(<App />);
  click("Create a new account");
  click("Create account");
  for (const label of ["Full name", "Email", "Password"]) {
    const input = screen.getByLabelText(label);
    expect(input).toHaveAttribute("aria-invalid", "true");
    const errorId = input.getAttribute("aria-describedby") ?? "";
    expect(document.getElementById(errorId)).toHaveTextContent(/\S/);
  }
  expect(screen.getByLabelText("Full name")).toHaveFocus();
});

it("registers, logs out, logs in and stays logged in after a remount", async () => {
  const { unmount } = render(<App />);
  await registerAda();
  expect(screen.getByText("$0.00")).toBeVisible();

  click("Log out");
  fill(creds);
  click("Log in");
  await screen.findByText("Welcome, Ada Lovelace");

  unmount();
  render(<App />);
  expect(screen.getByText("Welcome, Ada Lovelace")).toBeVisible();
});

it("shows a generic alert for a wrong password", async () => {
  render(<App />);
  await registerAda();
  click("Log out");
  fill({ ...creds, Password: "wrong-pass1" });
  click("Log in");
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Invalid email or password",
  );
});

it("shows a field error for a duplicate email", async () => {
  render(<App />);
  await registerAda();
  click("Log out");
  click("Create a new account");
  fill(account);
  click("Create account");
  await screen.findByText("An account with this email already exists");
  expect(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
});

it("shows a generic error when storage fails", async () => {
  render(<App />);
  click("Create a new account");
  fill(account);
  vi.spyOn(Storage.prototype, "setItem").mockImplementationOnce(() => {
    throw new Error("quota");
  });
  click("Create account");
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Could not save your data",
  );
});
