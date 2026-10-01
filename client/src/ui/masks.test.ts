import { describe, expect, it } from "vitest";
import {
  amount,
  cardNumber,
  cvv,
  email,
  expiry,
  personName,
} from "./masks";

describe("cardNumber", () => {
  it.each([
    ["", ""],
    ["1", "1"],
    ["1234", "1234"],
    ["12345", "1234 5"],
    ["1234abcd5678", "1234 5678"],
    ["1234 1234 1234 1234", "1234 1234 1234 1234"],
    ["1234123412341234999", "1234 1234 1234 1234"],
    ["4000-0000-0000-0002", "4000 0000 0000 0002"],
    ["abc", ""],
  ])("cardNumber(%j) = %j", (input, expected) => {
    expect(cardNumber(input)).toBe(expected);
  });
});

describe("expiry", () => {
  it.each([
    ["", ""],
    ["1", "1"],
    ["5", "05"],
    ["9", "09"],
    ["0", "0"],
    ["12", "12"],
    ["122", "12/2"],
    ["1226", "12/26"],
    ["12/26", "12/26"],
    ["12261", "12/26"],
    ["ab12cd26", "12/26"],
    ["526", "05/26"],
    ["//", ""],
  ])("expiry(%j) = %j", (input, expected) => {
    expect(expiry(input)).toBe(expected);
  });
});

describe("cvv", () => {
  it.each([
    ["", ""],
    ["12a3", "123"],
    ["12345", "123"],
    ["abc", ""],
  ])("cvv(%j) = %j", (input, expected) => {
    expect(cvv(input)).toBe(expected);
  });
});

describe("amount", () => {
  it.each([
    ["", ""],
    ["0", "0"],
    ["00", "0"],
    ["007", "7"],
    ["0.5", "0.5"],
    ["00.5", "0.5"],
    [".", "0."],
    [".5", "0.5"],
    ["1.", "1."],
    ["10.999", "10.99"],
    ["1a2.3b4", "12.34"],
    ["1,5", "1.5"],
    ["1.2.3", "1.23"],
    ["123456", "12345"],
    ["abc", ""],
  ])("amount(%j) = %j", (input, expected) => {
    expect(amount(input)).toBe(expected);
  });
});

describe("personName", () => {
  it.each([
    ["", ""],
    ["Ana2 Torres!", "Ana Torres"],
    ["  Ana", "Ana"],
    ["Ana  Torres", "Ana Torres"],
    ["Ana ", "Ana "],
    ["Ana 2 Torres", "Ana Torres"],
    ["José Núñez", "José Núñez"],
    ["O'Brien-Smith", "O'Brien-Smith"],
    ["Ana\tTorres", "Ana Torres"],
    ["1234", ""],
    ["a".repeat(150), "a".repeat(100)],
  ])("personName(%j) = %j", (input, expected) => {
    expect(personName(input)).toBe(expected);
  });
});

describe("email", () => {
  it.each([
    ["", ""],
    ["  ada @example.com ", "ada@example.com"],
    ["a\tb\nc@x.com", "abc@x.com"],
    ["a".repeat(300), "a".repeat(254)],
  ])("email(%j) = %j", (input, expected) => {
    expect(email(input)).toBe(expected);
  });
});

describe("idempotency", () => {
  const inputs = [
    "",
    "5",
    "0",
    ".",
    "122",
    "1226",
    "12/26",
    "ab12cd26",
    "1234abcd5678",
    "1234123412341234999",
    "007",
    "10.999",
    "1a2.3b4",
    "1,5",
    "Ana2 Torres!",
    "  Ana  ",
    "O'Brien-Smith",
    " a b@c .com ",
    "a".repeat(300),
    "9".repeat(30),
  ];
  const masks = { cardNumber, expiry, cvv, amount, personName, email };
  for (const [name, mask] of Object.entries(masks))
    it.each(inputs)(`${name}(f(%j)) is stable`, (input) => {
      expect(mask(mask(input))).toBe(mask(input));
    });
});
