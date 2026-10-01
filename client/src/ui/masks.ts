// Input masks are UX only: the server stays the source of truth for validation.
// There is deliberately no password mask: special characters strengthen passwords
// and NIST SP 800-63B advises against composition restrictions.
const onlyDigits = (v: string) => v.replace(/\D/g, "");

export const cardNumber = (v: string) =>
  (
    onlyDigits(v)
      .slice(0, 16)
      .match(/\d{1,4}/g) ?? []
  ).join(" ");

export function expiry(v: string) {
  let d = onlyDigits(v);
  if (/^[2-9]/.test(d)) d = `0${d}`;
  d = d.slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
}

export const cvv = (v: string) => onlyDigits(v).slice(0, 3);

export function amount(v: string) {
  const [int = "", ...rest] = v
    .replace(/,/g, ".")
    .replace(/[^\d.]/g, "")
    .split(".");
  const whole = int.replace(/^0+(?=\d)/, "").slice(0, 5);
  if (rest.length === 0) return whole;
  return `${whole || "0"}.${rest.join("").slice(0, 2)}`;
}

export const personName = (v: string) =>
  v
    .replace(/\s/g, " ")
    .replace(/[^\p{L} '-]/gu, "")
    .replace(/ {2,}/g, " ")
    .replace(/^ /, "")
    .slice(0, 100);

export const email = (v: string) => v.replace(/\s/g, "").slice(0, 254);
