export const PBKDF2_ITERATIONS = 600_000;

export type PasswordHash = {
  algorithm: "PBKDF2-SHA256";
  iterations: number;
  salt: string;
  hash: string;
};

const toB64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function derive(password: string, salt: Uint8Array, iterations: number) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    key,
    256,
  );
  return toB64(new Uint8Array(bits));
}

export async function hashPassword(
  password: string,
  iterations = PBKDF2_ITERATIONS,
): Promise<PasswordHash> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return {
    algorithm: "PBKDF2-SHA256",
    iterations,
    salt: toB64(salt),
    hash: await derive(password, salt, iterations),
  };
}

export async function verifyPassword(
  password: string,
  stored: PasswordHash,
): Promise<boolean> {
  const hash = await derive(password, fromB64(stored.salt), stored.iterations);
  // ponytail: plain === on base64 hashes; constant-time compare adds nothing in the browser
  return hash === stored.hash;
}
