import { useEffect, useRef, useState, type ReactNode } from "react";
import type { User } from "../auth/auth";
import { usd } from "../dashboard/Dashboard";
import { TextField } from "../ui/TextField";
import {
  ArrowRightIcon,
  CheckIcon,
  ClockIcon,
  WarningIcon,
  XIcon,
} from "../ui/icons";
import { charge, type ChargeResult } from "./snailpay";

type Fields = {
  card: string;
  exp: string;
  cvv: string;
  name: string;
  amount: string;
};
type FieldName = keyof Fields;
type Errors = Partial<Record<FieldName, string>>;
type View =
  | { name: "form" }
  | { name: "processing" }
  | { name: "result"; result: Exclude<ChargeResult, { kind: "invalid" }> };

type Props = {
  user: User;
  onClose: () => void;
  onCharge: (result: ChargeResult) => void;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
};

const EMPTY: Fields = { card: "", exp: "", cvv: "", name: "", amount: "" };
const digits = (v: string) => v.replace(/\s/g, "");

// Client-side rules mirror the server; the server stays the source of truth.
function validate(f: Fields): Errors {
  const amount = Number(f.amount);
  const errors: Errors = {};
  if (!/^\d{16}$/.test(digits(f.card)))
    errors.card = "Ingresa los 16 dígitos de tu tarjeta";
  if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(f.exp.trim()))
    errors.exp = "Usa el formato MM/AA";
  if (!/^\d{3}$/.test(f.cvv.trim()))
    errors.cvv = "Ingresa los 3 dígitos del CVV";
  if (!f.name.trim()) errors.name = "Ingresa el nombre del titular";
  if (
    !/^\d+(\.\d{1,2})?$/.test(f.amount.trim()) ||
    amount < 0.01 ||
    amount > 10000
  )
    errors.amount = "Ingresa un monto entre $0.01 y $10,000.00";
  return errors;
}

const FIELD_BY_DETAIL: Record<string, FieldName> = {
  cc_rejected_bad_filled_card_number: "card",
  cc_rejected_bad_filled_date: "exp",
  cc_rejected_bad_filled_security_code: "cvv",
  cc_rejected_bad_filled_name: "name",
  invalid_amount: "amount",
};

const REJECTED_COPY: Record<string, string> = {
  cc_rejected_card_declined:
    "Tu banco rechazó la tarjeta. Intenta con otra tarjeta.",
  cc_rejected_insufficient_amount: "Fondos insuficientes en la tarjeta.",
  cc_rejected_bad_filled_security_code: "El CVV no es correcto.",
  cc_rejected_bad_filled_date: "La fecha de vencimiento no es correcta.",
  cc_rejected_card_not_recognized: "No reconocemos esta tarjeta de prueba.",
};

const TEST_CARDS = [
  ["Aprobada", "1234 1234 1234 1234 · 12/26 · 543"],
  ["Rechazada", "4000 0000 0000 0002"],
  ["Fondos insuficientes", "4000 0000 0000 9995"],
  ["SnailPay no disponible", "5000 0000 0000 0009"],
  ["Tiempo agotado", "5000 0000 0000 0017"],
];

export function TopUpDialog({
  user,
  onClose,
  onCharge,
  timeoutMs,
  fetchImpl,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [view, setView] = useState<View>({ name: "form" });
  const [fields, setFields] = useState<Fields>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState("");

  // Capture the opener during render, before showModal() moves focus. Reading it inside the
  // effect breaks under StrictMode: the re-run sees the dialog's own input as the active element.
  const [trigger] = useState(() => document.activeElement);

  useEffect(() => {
    // Conditional mounting means the browser won't restore focus; do it here.
    dialogRef.current?.showModal();
    return () => {
      if (trigger instanceof HTMLElement) trigger.focus();
    };
  }, [trigger]);

  // Form: focus the first invalid field (or the first field); result: the heading.
  useEffect(() => {
    if (view.name === "form")
      (
        dialogRef.current?.querySelector<HTMLElement>(
          '[aria-invalid="true"]',
        ) ?? dialogRef.current?.querySelector<HTMLElement>("input")
      )?.focus();
    else headingRef.current?.focus();
  }, [view, errors]);

  const processing = view.name === "processing";

  async function pay(data: Fields) {
    setView({ name: "processing" });
    const result = await charge(
      {
        card_number: digits(data.card),
        expiration_date: data.exp.trim(),
        cvv: data.cvv.trim(),
        full_name: data.name.trim(),
        amount: Number(data.amount),
        payer_id: user.id,
        payer_email: user.email,
      },
      { timeoutMs, fetchImpl },
    );
    // A late response after unmount (logout/HMR) is still recorded: if the
    // server approved it, the transaction must not be lost. setState on an
    // unmounted component is a no-op in React 18+, so no guard is needed.
    if ("response" in result && result.response) {
      try {
        onCharge(result);
      } catch {
        setFormError(
          `No pudimos guardar tu saldo. Guarda esta referencia: ${result.response.reference}`,
        );
        setView({ name: "form" });
        return;
      }
    }
    if (result.kind === "invalid") {
      const field = FIELD_BY_DETAIL[result.response.status_detail];
      setErrors(field ? { [field]: "Revisa este dato" } : {});
      setFormError(
        field ? "" : "No pudimos procesar la solicitud. Revisa los datos.",
      );
      setView({ name: "form" });
    } else setView({ name: "result", result });
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const found = validate(fields);
    setErrors(found);
    setFormError("");
    if (Object.keys(found).length === 0) void pay(fields);
  }

  const set = (name: FieldName) => (value: string) =>
    setFields((f) => ({ ...f, [name]: value }));

  const retryForm = () => {
    setFields((f) => ({ ...f, cvv: "" }));
    setErrors({});
    setView({ name: "form" });
  };

  return (
    <dialog
      ref={dialogRef}
      className="topup"
      aria-labelledby="topup-title"
      onCancel={(e) => processing && e.preventDefault()}
      onClose={onClose}
    >
      {!processing && (
        <button
          type="button"
          className="topup-close"
          aria-label="Cerrar ventana"
          onClick={onClose}
        >
          <XIcon />
        </button>
      )}
      {view.name === "form" && (
        <form noValidate onSubmit={onSubmit}>
          <h2 id="topup-title">Cargar saldo con SnailPay</h2>
          <p className="subtitle">
            Ingresa los datos de tu tarjeta para cargar saldo a tu cuenta de
            Snail Club.
          </p>
          <TextField
            label="Número de tarjeta"
            name="card"
            type="text"
            inputMode="numeric"
            autoComplete="cc-number"
            placeholder="1234 5678 9012 3456"
            value={fields.card}
            error={errors.card}
            onChange={set("card")}
          />
          <div className="field-row">
            <TextField
              label="Vencimiento"
              name="exp"
              type="text"
              autoComplete="cc-exp"
              placeholder="MM/AA"
              value={fields.exp}
              error={errors.exp}
              onChange={set("exp")}
            />
            <TextField
              label="CVV"
              name="cvv"
              type="text"
              inputMode="numeric"
              autoComplete="cc-csc"
              placeholder="123"
              value={fields.cvv}
              error={errors.cvv}
              onChange={set("cvv")}
            />
          </div>
          <TextField
            label="Nombre del titular"
            name="holder"
            type="text"
            autoComplete="cc-name"
            placeholder="Como aparece en la tarjeta"
            value={fields.name}
            error={errors.name}
            onChange={set("name")}
          />
          <TextField
            label="Monto a cargar"
            name="amount"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0.00"
            hint="Máximo $10,000.00"
            value={fields.amount}
            error={errors.amount}
            onChange={set("amount")}
          />
          {formError && (
            <p className="form-error" role="alert">
              {formError}
            </p>
          )}
          <p className="topup-note">
            Estás en un entorno de prueba: no uses datos reales.
          </p>
          <details className="test-cards">
            <summary>Tarjetas de prueba</summary>
            <table>
              <tbody>
                {TEST_CARDS.map(([outcome, card]) => (
                  <tr key={outcome}>
                    <th scope="row">{outcome}</th>
                    <td>{card}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
          <button type="submit" className="primary">
            Pagar con SnailPay <ArrowRightIcon />
          </button>
        </form>
      )}

      {processing && (
        <div className="topup-state" role="status" aria-live="polite">
          <span className="spinner" aria-hidden="true" />
          <h2 id="topup-title" ref={headingRef} tabIndex={-1}>
            Procesando…
          </h2>
          <p>
            Estamos validando tu pago con SnailPay. Por favor, no cierres esta
            ventana.
          </p>
        </div>
      )}

      {view.name === "result" && (
        <Result
          result={view.result}
          headingRef={headingRef}
          onClose={onClose}
          onRetryForm={retryForm}
          onRetry={() => void pay(fields)}
        />
      )}
    </dialog>
  );
}

type ResultProps = {
  result: Extract<View, { name: "result" }>["result"];
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  onClose: () => void;
  onRetryForm: () => void;
  onRetry: () => void;
};

function Result({
  result,
  headingRef,
  onClose,
  onRetryForm,
  onRetry,
}: ResultProps) {
  const state = (
    tone: string,
    icon: ReactNode,
    title: string,
    body: ReactNode,
    actions: ReactNode,
  ) => (
    <div className="topup-state">
      <span className={`badge badge-${tone}`}>{icon}</span>
      <h2 id="topup-title" ref={headingRef} tabIndex={-1}>
        {title}
      </h2>
      {body}
      {actions}
    </div>
  );
  const close = (label: string) => (
    <button type="button" className="primary" onClick={onClose}>
      {label}
    </button>
  );

  switch (result.kind) {
    case "approved": {
      const { response } = result;
      return state(
        "ok",
        <CheckIcon />,
        "Pago aprobado",
        <>
          <p>Tu saldo ha sido cargado correctamente.</p>
          <p className="topup-amount">
            {usd.format(response.transaction_amount ?? 0)}
          </p>
          <p className="caption">Código de autorización</p>
          <p className="topup-code">{response.authorization_code}</p>
          <p className="topup-ref">Referencia {response.reference}</p>
        </>,
        close("Listo"),
      );
    }
    case "rejected":
      return state(
        "error",
        <XIcon />,
        "Tarjeta rechazada",
        <p>
          {REJECTED_COPY[result.response.status_detail] ??
            "No pudimos procesar tu pago. Intenta con otra tarjeta."}
        </p>,
        <button type="button" className="primary danger" onClick={onRetryForm}>
          Intentar de nuevo
        </button>,
      );
    case "timeout":
      return state(
        "info",
        <ClockIcon />,
        "La operación tardó demasiado",
        <p>
          No pudimos confirmar el pago. No se aplicó ningún cargo a tu saldo.
          Puedes intentar nuevamente.
        </p>,
        <>
          {/* ponytail: a real gateway needs an idempotency key so a retry after a client timeout can't charge twice */}
          <button type="button" className="primary" onClick={onRetry}>
            Reintentar
          </button>
          <button type="button" className="link" onClick={onClose}>
            Cerrar
          </button>
        </>,
      );
    default:
      return state(
        "warn",
        <WarningIcon />,
        "SnailPay no está disponible",
        <p>
          {result.kind === "network"
            ? "No pudimos conectar con SnailPay. Revisa tu conexión e intenta de nuevo."
            : "En este momento SnailPay no está disponible. Por favor, intenta más tarde."}
        </p>,
        close("Entendido"),
      );
  }
}
