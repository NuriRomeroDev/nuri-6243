import { describe, expect, it } from "vitest";
import { normalizeEmail, validateLogin, validateRegister } from "./validation";

const valid = {
  fullName: "Ada Lovelace",
  email: "ada@example.com",
  password: "abcdefg1",
  confirmPassword: "abcdefg1",
};

describe("validateRegister", () => {
  it("accepts valid values", () => {
    expect(validateRegister(valid)).toEqual({});
  });

  it.each([
    ["fullName", { fullName: " A " }],
    ["fullName", { fullName: "" }],
    ["fullName", { fullName: "a".repeat(101) }],
    ["email", { email: "nope" }],
    ["email", { email: "a@b" }],
    ["email", { email: `${"a".repeat(250)}@b.co` }],
    ["password", { password: "abc123", confirmPassword: "abc123" }],
    ["password", { password: "abcdefgh", confirmPassword: "abcdefgh" }],
    ["password", { password: "12345678", confirmPassword: "12345678" }],
    [
      "password",
      { password: "a1".repeat(65), confirmPassword: "a1".repeat(65) },
    ],
    ["confirmPassword", { confirmPassword: "different1" }],
  ])("rejects invalid %s (%j)", (field, override) => {
    const errors = validateRegister({ ...valid, ...override });
    expect(errors[field as keyof typeof errors]).toEqual(expect.any(String));
  });

  it("trims name and email but not the password", () => {
    expect(
      validateRegister({ ...valid, fullName: " Ad ", email: " a@b.co " }),
    ).toEqual({});
    const padded = { password: "  abc123 ", confirmPassword: "  abc123 " };
    expect(validateRegister({ ...valid, ...padded })).toEqual({});
    expect(
      validateRegister({ ...valid, confirmPassword: "abcdefg1 " }),
    ).toHaveProperty("confirmPassword");
  });
});

describe("validateLogin", () => {
  it.each([
    [{ email: "", password: "x" }, ["email"]],
    [{ email: "a@b.co", password: "" }, ["password"]],
    [{ email: " ", password: "" }, ["email", "password"]],
    [{ email: "a@b.co", password: "x" }, []],
  ])("%j -> %j", (values, keys) => {
    expect(Object.keys(validateLogin(values)).sort()).toEqual(keys);
  });
});

it("normalizeEmail trims and lowercases", () => {
  expect(normalizeEmail("  Ada@Example.COM ")).toBe("ada@example.com");
});

it("returns Spanish messages", () => {
  expect(validateRegister({ ...valid, confirmPassword: "x" })).toEqual({
    confirmPassword: "Las contraseñas no coinciden",
  });
  expect(validateLogin({ email: "", password: "" })).toEqual({
    email: "Ingresa tu correo",
    password: "Ingresa tu contraseña",
  });
});
