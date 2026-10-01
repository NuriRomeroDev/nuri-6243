import {
  PBKDF2_ITERATIONS,
  hashPassword,
  verifyPassword,
  type PasswordHash,
} from "./password";
import { isChargeResponse, type ChargeResponse } from "../topup/snailpay";
import { normalizeEmail } from "./validation";

export const USERS_KEY = "snail-racing:v1:users";
export const SESSION_KEY = "snail-racing:v1:session";
export const TRANSACTIONS_KEY = "snail-racing:v1:transactions";

export type UserRecord = {
  id: string;
  fullName: string;
  email: string;
  password: PasswordHash;
  balanceCents: number;
  createdAt: string;
};
export type User = Omit<UserRecord, "password">;
export type AuthResult =
  | { ok: true; user: User }
  | { ok: false; error: "EMAIL_TAKEN" | "INVALID_CREDENTIALS" };

type Session = { userId: string; createdAt: string };

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const isString = (v: unknown): v is string => typeof v === "string";

const isBase64 = (v: unknown): v is string =>
  isString(v) && /^[A-Za-z0-9+/]+={0,2}$/.test(v);

const isPasswordHash = (v: unknown): v is PasswordHash =>
  isObject(v) &&
  v.algorithm === "PBKDF2-SHA256" &&
  Number.isInteger(v.iterations) &&
  (v.iterations as number) >= 1 &&
  (v.iterations as number) <= 10_000_000 &&
  isBase64(v.salt) &&
  isBase64(v.hash);

const isUserRecord = (v: unknown): v is UserRecord =>
  isObject(v) &&
  isString(v.id) &&
  isString(v.fullName) &&
  isString(v.email) &&
  isPasswordHash(v.password) &&
  typeof v.balanceCents === "number" &&
  isString(v.createdAt);

const isSession = (v: unknown): v is Session =>
  isObject(v) && isString(v.userId) && isString(v.createdAt);

function readJson<T>(key: string, guard: (v: unknown) => v is T): T | null {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? "null");
    return guard(value) ? value : null;
  } catch {
    return null;
  }
}

const writeJson = (key: string, value: unknown) =>
  localStorage.setItem(key, JSON.stringify(value));

// Invalid records are dropped individually; a non-object value reads as {}.
const readUsers = () =>
  Object.fromEntries(
    Object.entries(readJson(USERS_KEY, isObject) ?? {}).filter(
      (entry): entry is [string, UserRecord] => isUserRecord(entry[1]),
    ),
  );

const toUser = ({
  id,
  fullName,
  email,
  balanceCents,
  createdAt,
}: UserRecord): User => ({ id, fullName, email, balanceCents, createdAt });

// Verified against when the email is unknown so both failures cost the same.
const DUMMY_HASH: PasswordHash = {
  algorithm: "PBKDF2-SHA256",
  iterations: PBKDF2_ITERATIONS,
  salt: btoa("\0".repeat(16)),
  hash: btoa("\0".repeat(32)),
};

function startSession(user: UserRecord): AuthResult {
  const session: Session = {
    userId: user.id,
    createdAt: new Date().toISOString(),
  };
  writeJson(SESSION_KEY, session);
  return { ok: true, user: toUser(user) };
}

// ponytail: trusts caller ran validateRegister
export async function register(input: {
  fullName: string;
  email: string;
  password: string;
}): Promise<AuthResult> {
  const email = normalizeEmail(input.email);
  const password = await hashPassword(input.password);
  // ponytail: single-tab assumption; the check-then-write below is not atomic across tabs
  const users = readUsers();
  if (users[email]) return { ok: false, error: "EMAIL_TAKEN" };
  const record: UserRecord = {
    id: crypto.randomUUID(),
    fullName: input.fullName.trim(),
    email,
    password,
    balanceCents: 0,
    createdAt: new Date().toISOString(),
  };
  // Session first: if the users write then fails, the orphan session is
  // ignored by currentUser and a retry is not blocked by EMAIL_TAKEN.
  const result = startSession(record);
  writeJson(USERS_KEY, { ...users, [email]: record });
  return result;
}

export async function login(
  email: string,
  password: string,
): Promise<AuthResult> {
  const record = readUsers()[normalizeEmail(email)];
  const ok = await verifyPassword(password, record?.password ?? DUMMY_HASH);
  if (!record || !ok) return { ok: false, error: "INVALID_CREDENTIALS" };
  return startSession(record);
}

export const logout = () => localStorage.removeItem(SESSION_KEY);

export function currentUser(): User | null {
  const session = readJson(SESSION_KEY, isSession);
  if (!session) return null;
  const record = Object.values(readUsers()).find(
    (u) => u.id === session.userId,
  );
  if (!record) {
    try {
      logout();
    } catch {
      // Runs during render; failing to clear an orphan session is harmless.
    }
    return null;
  }
  return toUser(record);
}

// Invalid entries are dropped individually; a corrupted store reads as empty.
const readTransactions = (): Record<string, ChargeResponse[]> =>
  Object.fromEntries(
    Object.entries(readJson(TRANSACTIONS_KEY, isObject) ?? {}).map(
      ([userId, list]) => [
        userId,
        Array.isArray(list) ? list.filter(isChargeResponse) : [],
      ],
    ),
  );

// Stores every attempt; credits the balance only for a new approved transaction.
// Write order: transactions first, then the user. If the second write fails the
// attempt is on record but not credited (a replay of that id will not credit
// either), so a failure can under-credit but never double-credit.
export function recordCharge(userId: string, response: ChargeResponse): User {
  const users = readUsers();
  const entry = Object.entries(users).find(([, u]) => u.id === userId);
  if (!entry) throw new Error("Unknown user");
  const [email, record] = entry;

  const all = readTransactions();
  const previous = all[userId] ?? [];
  const isNew = !previous.some((t) => t.id === response.id);
  // ponytail: card number and CVV are stored because the spec requires it; fictitious data only, never do this with real cards
  writeJson(TRANSACTIONS_KEY, {
    ...all,
    [userId]: [...previous, ...(isNew ? [response] : [])],
  });

  if (!isNew || response.status !== "approved") return toUser(record);
  const updated: UserRecord = {
    ...record,
    balanceCents:
      record.balanceCents +
      Math.round((response.transaction_amount ?? 0) * 100),
  };
  writeJson(USERS_KEY, { ...users, [email]: updated });
  return toUser(updated);
}
