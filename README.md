# Snail Club

A snail racing betting dashboard with simulated stats and a mock payment gateway (SnailPay). The UI is in Spanish.

- Register, log in and log out; the session and balance survive a page reload.
- Dashboard with balance, a donut chart of won and lost bets, and a bar chart of daily wins for 6 snails.
- Top-up flow against SnailPay with approval, declines, a system error and a timeout.

Stack: React 19 + Vite + TypeScript (client), Express 5 + TypeScript (API), Vitest, npm workspaces. No UI kit, chart library or state library.

## Prerequisites

- Node 22.22+ or 24.15+ (see `.nvmrc`)
- npm 10+

## Quick start

```sh
npm install
npm run dev
```

- Client: http://localhost:5173 (Vite proxies `/api` to the API)
- API: http://localhost:3001

Register any account, then use **Cargar saldo** with the test cards listed below. The same list is available inside the top-up dialog under **Tarjetas de prueba**.

## Production build

```sh
npm run build
npm start
```

The API serves the built client, so the whole app runs on one port: http://localhost:3001 (or `PORT`). `render.yaml` deploys it to Render as a single web service.

## Scripts

| Script              | Description                               |
| ------------------- | ----------------------------------------- |
| `npm run dev`       | Run client and server in watch mode       |
| `npm run build`     | Build both workspaces                     |
| `npm start`         | Serve the built app and API from one port |
| `npm test`          | Run all tests (client and server)         |
| `npm run lint`      | Run ESLint and check Prettier format      |
| `npm run typecheck` | Type-check both workspaces                |
| `npm run format`    | Format the repo with Prettier             |

## Project layout

```
client/src/
  auth/        validation, PBKDF2 hashing, localStorage auth service, useAuth hook
  dashboard/   seeded daily stats, dashboard and hand-made charts
  topup/       SnailPay client (timeout, response guard) and top-up dialog
  ui/          auth screens, text field, inline SVG icons
server/src/
  snailpay/    pure charge service and thin Express router
  static.ts    serves the built client in production
```

## Testing

`npm test` runs Vitest in both workspaces; CI runs lint, typecheck, test and build on every pull request. Tests focus on the logic that can lose money or data:

- **SnailPay API**: every validation rule and scenario, the response envelope on every path, body errors, and the timeout delay (injected so tests stay fast).
- **SnailPay client**: HTTP-to-result mapping, the 8 s abort, malformed responses, and that only HTTP 201 with `approved` counts as approved.
- **Balance**: credit happens once per approved transaction and never on declines, errors or mismatched responses.
- **Auth**: hashing, duplicate emails, generic login errors, corrupted `localStorage`.
- **UI flows** (Testing Library): register, log out, log in, reload, and every top-up state.

## Data in localStorage

| Key                            | Content                                                                                                |
| ------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `snail-racing:v1:users`        | accounts by email, with password hash and balance in cents                                             |
| `snail-racing:v1:session`      | current `userId`                                                                                       |
| `snail-racing:v1:transactions` | every SnailPay response per user, including card number and CVV (required by the spec; test data only) |

## SnailPay (mock payment API)

`POST /api/snailpay/charge` with a JSON body (max 10 KB). All card data is fictitious; card number and CVV are echoed back as the spec requires, so never send real card data.

```json
{
  "payer_id": "user-1",
  "payer_email": "ada@example.com",
  "card_number": "1234123412341234",
  "expiration_date": "12/26",
  "cvv": "543",
  "full_name": "Ada Lovelace",
  "amount": 10.5
}
```

| Field             | Rule                                      |
| ----------------- | ----------------------------------------- |
| `payer_id`        | non-empty string (after trim)             |
| `payer_email`     | string like `a@b.co`                      |
| `card_number`     | string of exactly 16 digits               |
| `expiration_date` | string `MM/YY`, month 01-12               |
| `cvv`             | string of exactly 3 digits                |
| `full_name`       | non-empty string (after trim)             |
| `amount`          | number, > 0, at most 2 decimals, <= 10000 |

### Validation (HTTP 422, `rejected`)

The first failing check wins, in this order. Strings are never coerced (`"10.00"` is invalid).

| Order | Field             | `status_detail`                        |
| ----- | ----------------- | -------------------------------------- |
| 1     | `payer_id`        | `invalid_payer_id`                     |
| 2     | `payer_email`     | `invalid_payer_email`                  |
| 3     | `card_number`     | `cc_rejected_bad_filled_card_number`   |
| 4     | `expiration_date` | `cc_rejected_bad_filled_date`          |
| 5     | `cvv`             | `cc_rejected_bad_filled_security_code` |
| 6     | `full_name`       | `cc_rejected_bad_filled_name`          |
| 7     | `amount`          | `invalid_amount`                       |

A malformed JSON body, a body that is not a JSON object, or a missing JSON content type returns 400 `rejected` / `invalid_request_body`. Other body errors keep their client status with the same status and detail: 413 for a body over 10 KB, 415 for an unsupported charset or content encoding. An empty JSON body is parsed as `{}` and fails validation with 422 `invalid_payer_id`.

### Scenarios (valid input)

| Card               | Expiry / CVV     | HTTP | `status`   | `status_detail`                                              |
| ------------------ | ---------------- | ---- | ---------- | ------------------------------------------------------------ |
| `1234123412341234` | `12/26` / `543`  | 201  | `approved` | `accredited`                                                 |
| `1234123412341234` | expiry not 12/26 | 402  | `rejected` | `cc_rejected_bad_filled_date`                                |
| `1234123412341234` | CVV not 543      | 402  | `rejected` | `cc_rejected_bad_filled_security_code`                       |
| `4000000000000002` | any              | 402  | `rejected` | `cc_rejected_card_declined`                                  |
| `4000000000009995` | any              | 402  | `rejected` | `cc_rejected_insufficient_amount`                            |
| `5000000000000009` | any              | 503  | `error`    | `service_unavailable` (simulated system error)               |
| `5000000000000017` | any              | 504  | `error`    | `processing_timeout` (simulated timeout, answers after 10 s) |
| any other card     | any              | 402  | `rejected` | `cc_rejected_card_not_recognized`                            |

Expiry is not checked against the clock. Unexpected server failures return 500 `error` / `internal_error`. The client gives up after 8 s, so in the app the timeout card shows the timeout state before the server's 504 arrives.

### Reproduce each response

With the API running (`npm run dev` or `npm start`), change only `card_number` (and `cvv` for the wrong-CVV case):

```sh
curl -i -X POST http://localhost:3001/api/snailpay/charge \
  -H 'Content-Type: application/json' \
  -d '{"payer_id":"user-1","payer_email":"ada@example.com","card_number":"1234123412341234","expiration_date":"12/26","cvv":"543","full_name":"Ada Lovelace","amount":10.5}'
```

| Try                                | Expected                |
| ---------------------------------- | ----------------------- |
| body above                         | 201 `approved`          |
| `"cvv":"999"`                      | 402 wrong security code |
| `"card_number":"4000000000000002"` | 402 card declined       |
| `"card_number":"4000000000009995"` | 402 insufficient amount |
| `"card_number":"5000000000000009"` | 503 system error        |
| `"card_number":"5000000000000017"` | 504 after 10 s          |
| `"amount":0`                       | 422 `invalid_amount`    |

### Response

Every response, including errors, has all of these fields.

| Field                | Description                                       |
| -------------------- | ------------------------------------------------- |
| `id`                 | random UUID                                       |
| `status`             | `approved`, `rejected` or `error`                 |
| `status_detail`      | reason code from the tables above                 |
| `transaction_amount` | amount rounded to 2 decimals, or `null`           |
| `date_created`       | ISO 8601 UTC timestamp                            |
| `authorization_code` | 6-digit string when approved, otherwise `null`    |
| `reference`          | `SNP-YYYYMMDD-NNNNNN` (UTC date, 6 random digits) |
| `payer_id`           | echoed if a string, otherwise `null`              |
| `payer_email`        | echoed if a string, otherwise `null`              |
| `card_number`        | echoed if a string, otherwise `null`              |
| `cvv`                | echoed if a string, otherwise `null`              |

## Security notes

Authentication is a client-side simulation: accounts and sessions live in `localStorage`, so anyone with devtools can read or edit them. It demonstrates the flow, not a security boundary.

What the simulation does:

- Passwords are hashed with PBKDF2-HMAC-SHA256 at 600,000 iterations (the OWASP recommendation) using the Web Crypto API. The plaintext is never stored.
- Each user gets a random 16-byte salt.
- Login returns one generic error for unknown email and wrong password, and verifies against a dummy hash for unknown emails, to limit user enumeration.
- Hashes are compared with plain `===`; a constant-time compare adds nothing when the attacker already controls the browser.

What a real backend would do:

- Hash server-side with argon2id or bcrypt.
- Rate-limit login attempts.
- Keep the session in an HttpOnly, Secure, SameSite cookie.
- Expire sessions server-side.

No dependencies were added for authentication.
