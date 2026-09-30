import { describe, expect, it } from "vitest";
import { PBKDF2_ITERATIONS, hashPassword, verifyPassword } from "./password";

const FAST = 1000;

describe("password hashing", () => {
  it("uses 600k iterations by default", () => {
    expect(PBKDF2_ITERATIONS).toBe(600_000);
  });

  it("stores algorithm, iterations, salt and hash without the plaintext", async () => {
    const stored = await hashPassword("secret123", FAST);
    expect(stored).toMatchObject({
      algorithm: "PBKDF2-SHA256",
      iterations: FAST,
    });
    expect(atob(stored.salt)).toHaveLength(16);
    expect(atob(stored.hash)).toHaveLength(32);
    expect(JSON.stringify(stored)).not.toContain("secret123");
  });

  it("verifies the right password and rejects a wrong one", async () => {
    const stored = await hashPassword("secret123", FAST);
    expect(await verifyPassword("secret123", stored)).toBe(true);
    expect(await verifyPassword("secret124", stored)).toBe(false);
  });

  it("uses a unique salt per hash", async () => {
    const [a, b] = await Promise.all([
      hashPassword("same", FAST),
      hashPassword("same", FAST),
    ]);
    expect(a.salt).not.toBe(b.salt);
    expect(a.hash).not.toBe(b.hash);
  });

  it("verifies with the stored iteration count", async () => {
    const stored = await hashPassword("secret123", 10);
    expect(await verifyPassword("secret123", stored)).toBe(true);
    expect(
      await verifyPassword("secret123", { ...stored, iterations: 11 }),
    ).toBe(false);
  });
});
