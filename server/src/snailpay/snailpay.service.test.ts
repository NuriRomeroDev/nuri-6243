import { describe, expect, it } from "vitest";
import {
  failureResponse,
  processCharge,
  validateCharge,
} from "./snailpay.service.js";

const deps = {
  now: () => new Date("2026-01-15T10:00:00Z"),
  uuid: () => "uuid-1",
  digits: (n: number) => "1".repeat(n),
};
const valid = {
  payer_id: "p1",
  payer_email: "a@b.co",
  card_number: "1234123412341234",
  expiration_date: "12/26",
  cvv: "543",
  full_name: "Ada Lovelace",
  amount: 10,
};
const run = (o: Record<string, unknown> = {}) =>
  processCharge({ ...valid, ...o }, deps);

describe("validateCharge", () => {
  it("accepts a valid body", () => {
    expect(validateCharge(valid)).toEqual({ ok: true, value: valid });
  });

  it.each([
    [{ payer_id: "  " }, "invalid_payer_id"],
    [{ payer_id: 1 }, "invalid_payer_id"],
    [{ payer_email: "nope" }, "invalid_payer_email"],
    [{ card_number: "123" }, "cc_rejected_bad_filled_card_number"],
    [{ card_number: 1234123412341234 }, "cc_rejected_bad_filled_card_number"],
    [{ expiration_date: "13/26" }, "cc_rejected_bad_filled_date"],
    [{ expiration_date: "00/26" }, "cc_rejected_bad_filled_date"],
    [{ cvv: "54" }, "cc_rejected_bad_filled_security_code"],
    [{ full_name: " " }, "cc_rejected_bad_filled_name"],
    [{ amount: "10.00" }, "invalid_amount"],
    [{ amount: 0 }, "invalid_amount"],
    [{ amount: -1 }, "invalid_amount"],
    [{ amount: 1.234 }, "invalid_amount"],
    [{ amount: NaN }, "invalid_amount"],
    [{ amount: 10000.01 }, "invalid_amount"],
  ])("rejects %j with %s", (override, detail) => {
    expect(validateCharge({ ...valid, ...override })).toEqual({
      ok: false,
      detail,
    });
  });

  it.each([10000, 0.01, 19.99])("accepts amount %s", (amount) => {
    expect(validateCharge({ ...valid, amount }).ok).toBe(true);
  });

  it("reports the first failure in order", () => {
    const bad = Object.fromEntries(Object.keys(valid).map((k) => [k, ""]));
    expect(validateCharge(bad)).toMatchObject({ detail: "invalid_payer_id" });
    expect(validateCharge({ ...bad, payer_id: "p" })).toMatchObject({
      detail: "invalid_payer_email",
    });
  });
});

describe("processCharge", () => {
  it.each([
    [{}, "approved", "accredited"],
    [{ expiration_date: "01/30" }, "declined", "cc_rejected_bad_filled_date"],
    [{ cvv: "999" }, "declined", "cc_rejected_bad_filled_security_code"],
  ])("exact test card with %j", (override, kind, detail) => {
    expect(run(override)).toMatchObject({
      kind,
      response: { status_detail: detail },
    });
  });

  it.each([
    ["4000000000000002", "declined", "rejected", "cc_rejected_card_declined"],
    [
      "4000000000009995",
      "declined",
      "rejected",
      "cc_rejected_insufficient_amount",
    ],
    ["5000000000000009", "unavailable", "error", "service_unavailable"],
    ["5000000000000017", "timeout", "error", "processing_timeout"],
    [
      "4111111111111111",
      "declined",
      "rejected",
      "cc_rejected_card_not_recognized",
    ],
  ])("card %s", (card_number, kind, status, detail) => {
    const out = run({ card_number });
    expect(out).toMatchObject({
      kind,
      response: { status, status_detail: detail, authorization_code: null },
    });
  });

  it("returns invalid with the validation detail", () => {
    expect(run({ cvv: "x" })).toMatchObject({
      kind: "invalid",
      response: {
        status: "rejected",
        status_detail: "cc_rejected_bad_filled_security_code",
      },
    });
  });

  it.each([null, [], "x", 1, undefined])("malformed body %j", (body) => {
    expect(processCharge(body, deps)).toMatchObject({
      kind: "malformed",
      response: { status: "rejected", status_detail: "invalid_request_body" },
    });
  });
});

describe("envelope", () => {
  it("has every key and the approved values", () => {
    expect(run().response).toEqual({
      id: "uuid-1",
      status: "approved",
      status_detail: "accredited",
      transaction_amount: 10,
      date_created: "2026-01-15T10:00:00.000Z",
      authorization_code: "111111",
      reference: "SNP-20260115-111111",
      payer_id: "p1",
      payer_email: "a@b.co",
      card_number: "1234123412341234",
      cvv: "543",
    });
  });

  it("rounds the amount and echoes only strings", () => {
    expect(run({ amount: 19.999 }).response).toMatchObject({
      transaction_amount: 20,
      status_detail: "invalid_amount",
    });
    expect(run({ card_number: 5, cvv: 5, payer_id: 7 }).response).toMatchObject(
      { card_number: null, cvv: null, payer_id: null },
    );
  });

  it("failureResponse keeps the full envelope", () => {
    expect(failureResponse("internal_error", deps)).toEqual({
      id: "uuid-1",
      status: "error",
      status_detail: "internal_error",
      transaction_amount: null,
      date_created: "2026-01-15T10:00:00.000Z",
      authorization_code: null,
      reference: "SNP-20260115-111111",
      payer_id: null,
      payer_email: null,
      card_number: null,
      cvv: null,
    });
  });
});
