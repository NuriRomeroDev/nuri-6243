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
  // Keep the month within 01-12 while typing: "5" → "05", "13" → "01/3", "00" → "0".
  let d = onlyDigits(v).replace(/^00+/, "0");
  if (/^[2-9]/.test(d)) d = `0${d}`;
  else if (/^1[3-9]/.test(d)) d = `01${d.slice(1)}`;
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
    // NFC first: macOS can paste accents as separate combining marks ("e" + "´").
    .normalize("NFC")
    .replace(/\s/g, " ")
    .replace(/[^\p{L}\p{M} '.-]/gu, "")
    .replace(/ {2,}/g, " ")
    .replace(/^ /, "")
    .slice(0, 100);

export const email = (v: string) => v.replace(/\s/g, "").slice(0, 254);
