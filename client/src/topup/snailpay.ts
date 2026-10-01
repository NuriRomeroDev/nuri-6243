// Mirrors the server contract (server/src/snailpay); no shared package by design.
export type ChargeRequest = {
  card_number: string;
  expiration_date: string;
  cvv: string;
  full_name: string;
  amount: number;
  payer_id: string;
  payer_email: string;
};

export type ChargeResponse = {
  id: string;
  status: "approved" | "rejected" | "error";
  status_detail: string;
  transaction_amount: number | null;
  date_created: string;
  authorization_code: string | null;
  reference: string;
  payer_id: string | null;
  payer_email: string | null;
  card_number: string | null;
  cvv: string | null;
};

export type ChargeResult =
  | { kind: "approved"; response: ChargeResponse }
  | { kind: "rejected"; response: ChargeResponse }
  | { kind: "invalid"; response: ChargeResponse }
  | { kind: "unavailable"; response?: ChargeResponse }
  | { kind: "timeout" }
  | { kind: "network" };

const isNullableString = (v: unknown) => v === null || typeof v === "string";

// Network input is untrusted: check every key before treating it as a response.
export function isChargeResponse(v: unknown): v is ChargeResponse {
  if (typeof v !== "object" || v === null) return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.id === "string" &&
    (r.status === "approved" ||
      r.status === "rejected" ||
      r.status === "error") &&
    typeof r.status_detail === "string" &&
    (r.transaction_amount === null ||
      typeof r.transaction_amount === "number") &&
    typeof r.date_created === "string" &&
    isNullableString(r.authorization_code) &&
    typeof r.reference === "string" &&
    isNullableString(r.payer_id) &&
    isNullableString(r.payer_email) &&
    isNullableString(r.card_number) &&
    isNullableString(r.cvv)
  );
}

export async function charge(
  req: ChargeRequest,
  {
    timeoutMs = 8_000,
    fetchImpl = fetch,
  }: {
    timeoutMs?: number;
    fetchImpl?: typeof fetch;
  } = {},
): Promise<ChargeResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl("/api/snailpay/charge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
      signal: controller.signal,
    });
    if (res.status === 504) return { kind: "timeout" };
    const body: unknown = await res.json().catch(() => null);
    if (!isChargeResponse(body)) return { kind: "unavailable" };
    if (res.status === 201 && body.status === "approved") {
      // Never credit money the gateway did not confirm for this exact request.
      const matches =
        Math.round((body.transaction_amount ?? NaN) * 100) ===
          Math.round(req.amount * 100) && body.payer_id === req.payer_id;
      return matches
        ? { kind: "approved", response: body }
        : { kind: "unavailable", response: body };
    }
    if ([400, 413, 415, 422].includes(res.status))
      return { kind: "invalid", response: body };
    if (res.status === 402) return { kind: "rejected", response: body };
    return { kind: "unavailable", response: body };
  } catch (e) {
    return controller.signal.aborted || (e as Error).name === "AbortError"
      ? { kind: "timeout" }
      : { kind: "network" };
  } finally {
    clearTimeout(timer);
  }
}
