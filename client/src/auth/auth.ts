import {
  PBKDF2_ITERATIONS,
  hashPassword,
  verifyPassword,
  type PasswordHash,
} from "./password";
import { normalizeEmail } from "./validation";

export const USERS_KEY = "snail-racing:v1:users";
export const SESSION_KEY = "snail-racing:v1:session";

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

const isPasswordHash = (v: unknown): v is PasswordHash =>
  isObject(v) &&
  v.algorithm === "PBKDF2-SHA256" &&
  typeof v.iterations === "number" &&
  isString(v.salt) &&
  isString(v.hash);

const isUserRecord = (v: unknown): v is UserRecord =>
  isObject(v) &&
  isString(v.id) &&
  isString(v.fullName) &&
  isString(v.email) &&
  isPasswordHash(v.password) &&
  typeof v.balanceCents === "number" &&
  isString(v.createdAt);

const isUsers = (v: unknown): v is Record<string, UserRecord> =>
  isObject(v) && Object.values(v).every(isUserRecord);

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

// ponytail: corrupted users data is read as {} and overwritten on next register
const readUsers = () => readJson(USERS_KEY, isUsers) ?? {};

const toUser = ({ password: _password, ...user }: UserRecord): User => user;

// Verified against when the email is unknown so both failures cost the same.
const DUMMY_HASH: PasswordHash = {
  algorithm: "PBKDF2-SHA256",
  iterations: PBKDF2_ITERATIONS,
  salt: btoa("\0".repeat(16)),
  hash: btoa("\0".repeat(32)),
};

function startSession(user: UserRecord): AuthResult {
  const session: Session = { userId: user.id, createdAt: new Date().toISOString() };
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
  writeJson(USERS_KEY, { ...users, [email]: record });
  return startSession(record);
}

export async function login(email: string, password: string): Promise<AuthResult> {
  const record = readUsers()[normalizeEmail(email)];
  const ok = await verifyPassword(password, record?.password ?? DUMMY_HASH);
  if (!record || !ok) return { ok: false, error: "INVALID_CREDENTIALS" };
  return startSession(record);
}

export const logout = () => localStorage.removeItem(SESSION_KEY);

export function currentUser(): User | null {
  const session = readJson(SESSION_KEY, isSession);
  if (!session) return null;
  const record = Object.values(readUsers()).find((u) => u.id === session.userId);
  if (!record) {
    logout();
    return null;
  }
  return toUser(record);
}
