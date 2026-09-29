import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { snailpayRouter } from "./snailpay.routes.js";
import { processCharge } from "./snailpay.service.js";

// Real implementation by default; one test overrides it to force a crash.
vi.mock("./snailpay.service.js", async (importOriginal) => {
  const orig = await importOriginal<typeof import("./snailpay.service.js")>();
  return { ...orig, processCharge: vi.fn(orig.processCharge) };
});

const build = (timeoutDelayMs = 0) =>
  express().use("/api/snailpay", snailpayRouter({ timeoutDelayMs }));
const valid = {
  payer_id: "p1",
  payer_email: "a@b.co",
  card_number: "1234123412341234",
  expiration_date: "12/26",
  cvv: "543",
  full_name: "Ada Lovelace",
  amount: 10,
};
const post = (body: object | string, delay?: number) =>
  request(build(delay)).post("/api/snailpay/charge").type("json").send(body);

describe("POST /api/snailpay/charge", () => {
  afterEach(() => vi.restoreAllMocks());

  it.each([
    [{}, 201, "approved", "accredited"],
    [
      { expiration_date: "01/30" },
      402,
      "rejected",
      "cc_rejected_bad_filled_date",
    ],
    [{ cvv: "999" }, 402, "rejected", "cc_rejected_bad_filled_security_code"],
    [
      { card_number: "4000000000000002" },
      402,
      "rejected",
      "cc_rejected_card_declined",
    ],
    [
      { card_number: "4000000000009995" },
      402,
      "rejected",
      "cc_rejected_insufficient_amount",
    ],
    [
      { card_number: "4111111111111111" },
      402,
      "rejected",
      "cc_rejected_card_not_recognized",
    ],
    [{ card_number: "5000000000000009" }, 503, "error", "service_unavailable"],
    [{ card_number: "5000000000000017" }, 504, "error", "processing_timeout"],
    [{ payer_id: "" }, 422, "rejected", "invalid_payer_id"],
  ])("maps %j to %i", async (override, code, status, detail) => {
    const res = await post({ ...valid, ...override });
    expect(res.status).toBe(code);
    expect(res.body).toMatchObject({ status, status_detail: detail });
  });

  it.each([
    ["malformed JSON", "{oops", 400],
    ["oversized body", JSON.stringify({ pad: "x".repeat(11_000) }), 413],
  ])("%s", async (_n, body, code) => {
    const res = await post(body);
    expect(res.status).toBe(code);
    expect(res.body).toMatchObject({ status_detail: "invalid_request_body" });
  });

  it("rejects a body without a JSON content type", async () => {
    const res = await request(build())
      .post("/api/snailpay/charge")
      .type("text")
      .send("hi");
    expect(res.status).toBe(400);
    expect(res.body.status_detail).toBe("invalid_request_body");
  });

  it("answers other client body errors with their 4xx status", async () => {
    const res = await request(build())
      .post("/api/snailpay/charge")
      .set("Content-Type", "application/json")
      .set("Content-Encoding", "foo")
      .send(JSON.stringify(valid));
    expect(res.status).toBe(415);
    expect(res.body).toMatchObject({
      status: "rejected",
      status_detail: "invalid_request_body",
    });
  });

  it("waits before answering a timeout", async () => {
    const start = Date.now();
    const res = await post({ ...valid, card_number: "5000000000000017" }, 50);
    expect(res.status).toBe(504);
    expect(Date.now() - start).toBeGreaterThanOrEqual(45);
  });

  it("returns a 500 envelope on unexpected errors", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(processCharge).mockImplementationOnce(() => {
      throw new Error("boom");
    });
    const res = await post(valid);
    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({
      status: "error",
      status_detail: "internal_error",
      authorization_code: null,
    });
  });
});
