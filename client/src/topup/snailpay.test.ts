import { afterEach, describe, expect, it, vi } from "vitest";
import { charge, isChargeResponse, type ChargeRequest } from "./snailpay";

const req: ChargeRequest = {
  card_number: "1234123412341234",
  expiration_date: "12/26",
  cvv: "543",
  full_name: "Ada Lovelace",
  amount: 10,
  payer_id: "u1",
  payer_email: "ada@example.com",
};
const envelope = (status: string, detail: string) => ({
  id: "t1",
  status,
  status_detail: detail,
  transaction_amount: 10,
  date_created: "2026-01-01T00:00:00.000Z",
  authorization_code: status === "approved" ? "123456" : null,
  reference: "SNP-20260101-000001",
  payer_id: "u1",
  payer_email: "ada@example.com",
  card_number: "1234123412341234",
  cvv: "543",
});
const reply = (httpStatus: number, body: unknown) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status: httpStatus }));

afterEach(() => vi.useRealTimers());

describe("isChargeResponse", () => {
  it("accepts a full envelope and rejects missing keys or bad status", () => {
    expect(isChargeResponse(envelope("approved", "accredited"))).toBe(true);
    const { id: _id, ...noId } = envelope("approved", "accredited");
    expect(isChargeResponse(noId)).toBe(false);
    expect(isChargeResponse({ ...envelope("x", "y") })).toBe(false);
    expect(isChargeResponse(null)).toBe(false);
    expect(isChargeResponse("nope")).toBe(false);
  });
});

describe("charge", () => {
  it("posts JSON to the charge endpoint", async () => {
    const fetchImpl = reply(201, envelope("approved", "accredited"));
    await charge(req, { fetchImpl });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("/api/snailpay/charge");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual(req);
  });

  it("maps 201 + approved to approved", async () => {
    const r = await charge(req, {
      fetchImpl: reply(201, envelope("approved", "accredited")),
    });
    expect(r.kind).toBe("approved");
  });

  it("never approves unless both 201 and status approved", async () => {
    const a = await charge(req, {
      fetchImpl: reply(201, envelope("rejected", "cc_rejected_card_declined")),
    });
    const b = await charge(req, {
      fetchImpl: reply(200, envelope("approved", "accredited")),
    });
    expect(a.kind).not.toBe("approved");
    expect(b.kind).not.toBe("approved");
  });

  it.each([
    [402, "rejected", "cc_rejected_card_declined", "rejected"],
    [422, "rejected", "cc_rejected_bad_filled_date", "invalid"],
    [400, "rejected", "invalid_request_body", "invalid"],
    [413, "rejected", "invalid_request_body", "invalid"],
    [415, "rejected", "invalid_request_body", "invalid"],
    [503, "error", "service_unavailable", "unavailable"],
    [500, "error", "internal_error", "unavailable"],
    [504, "error", "processing_timeout", "timeout"],
  ])("maps HTTP %i to %s", async (httpStatus, status, detail, kind) => {
    const r = await charge(req, {
      fetchImpl: reply(httpStatus, envelope(status, detail)),
    });
    expect(r.kind).toBe(kind);
  });

  it("keeps the response for unavailable and rejected results", async () => {
    const r = await charge(req, {
      fetchImpl: reply(503, envelope("error", "service_unavailable")),
    });
    expect(r.kind === "unavailable" && r.response?.id).toBe("t1");
  });

  it("treats malformed JSON as unavailable", async () => {
    const fetchImpl = vi.fn(
      async () => new Response("<html>", { status: 201 }),
    );
    expect((await charge(req, { fetchImpl })).kind).toBe("unavailable");
  });

  it("treats a body that fails the guard as unavailable", async () => {
    const r = await charge(req, {
      fetchImpl: reply(201, { status: "approved" }),
    });
    expect(r.kind).toBe("unavailable");
  });

  it("treats unexpected HTTP codes as unavailable", async () => {
    const r = await charge(req, {
      fetchImpl: reply(418, envelope("error", "internal_error")),
    });
    expect(r.kind).toBe("unavailable");
  });

  it("maps a thrown fetch to network", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("offline");
    });
    expect((await charge(req, { fetchImpl })).kind).toBe("network");
  });

  it("times out when the request outlives timeoutMs", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_res, rej) =>
          init?.signal?.addEventListener("abort", () =>
            rej(new DOMException("aborted", "AbortError")),
          ),
        ),
    );
    const p = charge(req, { timeoutMs: 50, fetchImpl });
    await vi.advanceTimersByTimeAsync(50);
    expect((await p).kind).toBe("timeout");
  });

  it("clears the timer on success", async () => {
    vi.useFakeTimers();
    await charge(req, {
      fetchImpl: reply(201, envelope("approved", "accredited")),
    });
    expect(vi.getTimerCount()).toBe(0);
  });
});
