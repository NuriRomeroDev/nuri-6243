import { randomInt, randomUUID } from "node:crypto";

export type RejectedDetail =
  | "invalid_request_body"
  | "invalid_payer_id"
  | "invalid_payer_email"
  | "invalid_amount"
  | "cc_rejected_bad_filled_card_number"
  | "cc_rejected_bad_filled_date"
  | "cc_rejected_bad_filled_security_code"
  | "cc_rejected_bad_filled_name"
  | "cc_rejected_card_declined"
  | "cc_rejected_insufficient_amount"
  | "cc_rejected_card_not_recognized";
export type ErrorDetail =
  "service_unavailable" | "processing_timeout" | "internal_error";

interface EnvelopeBase {
  id: string;
  date_created: string;
  reference: string;
  transaction_amount: number | null;
  payer_id: string | null;
  payer_email: string | null;
  card_number: string | null;
  cvv: string | null;
}
export type ChargeResponse = EnvelopeBase &
  (
    | {
        status: "approved";
        status_detail: "accredited";
        authorization_code: string;
      }
    | {
        status: "rejected";
        status_detail: RejectedDetail;
        authorization_code: null;
      }
    | {
        status: "error";
        status_detail: ErrorDetail;
        authorization_code: null;
      }
  );

export interface ChargeRequest {
  payer_id: string;
  payer_email: string;
  card_number: string;
  expiration_date: string;
  cvv: string;
  full_name: string;
  amount: number;
}
export type Validation =
  { ok: true; value: ChargeRequest } | { ok: false; detail: RejectedDetail };

export type OutcomeKind =
  "approved" | "malformed" | "invalid" | "declined" | "unavailable" | "timeout";
export interface ChargeOutcome {
  kind: OutcomeKind;
  response: ChargeResponse;
}

export interface ChargeDeps {
  now: () => Date;
  uuid: () => string;
  digits: (n: number) => string;
}
const defaultDeps: ChargeDeps = {
  now: () => new Date(),
  uuid: randomUUID,
  digits: (n) => String(randomInt(0, 10 ** n)).padStart(n, "0"),
};

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown) => (typeof v === "string" ? v : null);
const blank = (v: unknown) => typeof v !== "string" || v.trim() === "";
const bad = (v: unknown, re: RegExp) => typeof v !== "string" || !re.test(v);

const badAmount = (a: unknown) =>
  typeof a !== "number" ||
  !Number.isFinite(a) ||
  a < 0.01 ||
  a > 10000 ||
  Math.abs(a * 100 - Math.round(a * 100)) >= 1e-9;

export function validateCharge(body: unknown): Validation {
  const b = isObject(body) ? body : {};
  // Checks run in the documented order; the first failure wins.
  const checks: [boolean, RejectedDetail][] = [
    [blank(b.payer_id), "invalid_payer_id"],
    [bad(b.payer_email, /^[^\s@]+@[^\s@]+\.[^\s@]+$/), "invalid_payer_email"],
    [bad(b.card_number, /^\d{16}$/), "cc_rejected_bad_filled_card_number"],
    [
      bad(b.expiration_date, /^(0[1-9]|1[0-2])\/\d{2}$/),
      "cc_rejected_bad_filled_date",
    ],
    [bad(b.cvv, /^\d{3}$/), "cc_rejected_bad_filled_security_code"],
    [blank(b.full_name), "cc_rejected_bad_filled_name"],
    [badAmount(b.amount), "invalid_amount"],
  ];
  const failed = checks.find(([fails]) => fails);
  return failed
    ? { ok: false, detail: failed[1] }
    : { ok: true, value: b as unknown as ChargeRequest };
}

function envelope(
  body: unknown,
  status: ChargeResponse["status"],
  status_detail: ChargeResponse["status_detail"],
  deps: ChargeDeps,
): ChargeResponse {
  const b = isObject(body) ? body : {};
  const now = deps.now();
  const a = b.amount;
  return {
    id: deps.uuid(),
    status,
    status_detail,
    transaction_amount:
      typeof a === "number" && Number.isFinite(a)
        ? Math.round(a * 100) / 100
        : null,
    date_created: now.toISOString(),
    authorization_code: status === "approved" ? deps.digits(6) : null,
    reference: `SNP-${now.toISOString().slice(0, 10).replaceAll("-", "")}-${deps.digits(6)}`,
    payer_id: str(b.payer_id),
    payer_email: str(b.payer_email),
    // ponytail: echoing card number and CVV is required by the spec; never do this with real card data (PCI)
    card_number: str(b.card_number),
    cvv: str(b.cvv),
  } as ChargeResponse;
}

const CARD_SCENARIOS: Record<
  string,
  [OutcomeKind, ChargeResponse["status"], ChargeResponse["status_detail"]]
> = {
  "4000000000000002": ["declined", "rejected", "cc_rejected_card_declined"],
  "4000000000009995": [
    "declined",
    "rejected",
    "cc_rejected_insufficient_amount",
  ],
  "5000000000000009": ["unavailable", "error", "service_unavailable"],
  "5000000000000017": ["timeout", "error", "processing_timeout"],
};

export function processCharge(
  body: unknown,
  deps: ChargeDeps = defaultDeps,
): ChargeOutcome {
  const out = (
    kind: OutcomeKind,
    status: ChargeResponse["status"],
    detail: ChargeResponse["status_detail"],
  ) => ({ kind, response: envelope(body, status, detail, deps) });

  if (!isObject(body))
    return out("malformed", "rejected", "invalid_request_body");
  const v = validateCharge(body);
  if (!v.ok) return out("invalid", "rejected", v.detail);

  const { card_number, expiration_date, cvv } = v.value;
  if (card_number === "1234123412341234") {
    // ponytail: expiry is not checked against the clock so the documented test card keeps working
    if (expiration_date !== "12/26")
      return out("declined", "rejected", "cc_rejected_bad_filled_date");
    if (cvv !== "543")
      return out(
        "declined",
        "rejected",
        "cc_rejected_bad_filled_security_code",
      );
    return out("approved", "approved", "accredited");
  }
  const s = CARD_SCENARIOS[card_number];
  return s
    ? out(...s)
    : out("declined", "rejected", "cc_rejected_card_not_recognized");
}

export function failureResponse(
  detail: "invalid_request_body" | "internal_error",
  deps: ChargeDeps = defaultDeps,
): ChargeResponse {
  return envelope(
    undefined,
    detail === "internal_error" ? "error" : "rejected",
    detail,
    deps,
  );
}
