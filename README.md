# Snail Racing

A snail racing betting dashboard with a mock payment gateway.

## Prerequisites

- Node 22 (see `.nvmrc`)
- npm 10+

## Quick start

```sh
npm install
npm run dev
```

- Client: http://localhost:5173
- API: http://localhost:3001

## Scripts

| Script              | Description                          |
| ------------------- | ------------------------------------ |
| `npm run dev`       | Run client and server in watch mode  |
| `npm run build`     | Build both workspaces                |
| `npm test`          | Run all tests                        |
| `npm run lint`      | Run ESLint and check Prettier format |
| `npm run typecheck` | Type-check both workspaces           |
| `npm run format`    | Format the repo with Prettier        |

## Project layout

- `client/` - React + Vite frontend
- `server/` - Express API

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

Expiry is not checked against the clock. Unexpected server failures return 500 `error` / `internal_error`.

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
