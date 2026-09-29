import { beforeEach, describe, expect, it, vi } from "vitest";
import { USERS_KEY, SESSION_KEY, currentUser, login, logout, register } from "./auth";
import { verifyPassword } from "./password";

vi.mock("./password", async (importOriginal) => {
  const real = await importOriginal<typeof import("./password")>();
  return {
    ...real,
    hashPassword: (pw: string) => real.hashPassword(pw, 1),
    verifyPassword: vi.fn(real.verifyPassword),
  };
});

const ada = { fullName: "Ada Lovelace", email: "Ada@Example.com", password: "secret123" };
const users = () => JSON.parse(localStorage.getItem(USERS_KEY) ?? "{}");

beforeEach(() => {
  vi.mocked(verifyPassword).mockClear();
});

describe("register", () => {
  it("stores a normalized user, hashes the password and logs in", async () => {
    const result = await register(ada);
    expect(result).toMatchObject({
      ok: true,
      user: { fullName: "Ada Lovelace", email: "ada@example.com", balanceCents: 0 },
    });
    expect(users()["ada@example.com"].password.algorithm).toBe("PBKDF2-SHA256");
    expect(currentUser()?.email).toBe("ada@example.com");
    expect(JSON.stringify(localStorage)).not.toContain("secret123");
    if (result.ok) expect(result.user).not.toHaveProperty("password");
  });

  it("rejects a duplicate email in any case and leaves the record unchanged", async () => {
    await register(ada);
    const before = localStorage.getItem(USERS_KEY);
    const result = await register({ ...ada, email: " ADA@example.COM ", fullName: "Other" });
    expect(result).toEqual({ ok: false, error: "EMAIL_TAKEN" });
    expect(localStorage.getItem(USERS_KEY)).toBe(before);
  });

  it("propagates storage failures", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementationOnce(() => {
      throw new Error("quota");
    });
    await expect(register(ada)).rejects.toThrow("quota");
  });
});

describe("login", () => {
  beforeEach(async () => {
    await register(ada);
    logout();
  });

  it("logs in with a differently-cased email", async () => {
    const result = await login(" ADA@example.com", "secret123");
    expect(result.ok).toBe(true);
    expect(currentUser()?.fullName).toBe("Ada Lovelace");
  });

  it("returns the same error for a wrong password and an unknown email", async () => {
    const wrong = await login("ada@example.com", "nope");
    const unknown = await login("ghost@example.com", "nope");
    expect(wrong).toEqual({ ok: false, error: "INVALID_CREDENTIALS" });
    expect(unknown).toEqual(wrong);
    expect(currentUser()).toBeNull();
  });

  it("still verifies against a dummy hash for an unknown email", async () => {
    await login("ghost@example.com", "nope");
    expect(verifyPassword).toHaveBeenCalledTimes(1);
  });
});

describe("session", () => {
  it("logout removes the session", async () => {
    await register(ada);
    logout();
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
    expect(currentUser()).toBeNull();
  });

  it("clears an orphan session", () => {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ userId: "x", createdAt: "now" }));
    expect(currentUser()).toBeNull();
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
  });

  it.each([
    ["corrupted JSON", "{not json"],
    ["wrong shape", JSON.stringify({ "a@b.co": { id: 1 } })],
    ["array", "[]"],
  ])("treats %s users data as empty", async (_, raw) => {
    localStorage.setItem(USERS_KEY, raw);
    expect(await login("a@b.co", "x")).toEqual({ ok: false, error: "INVALID_CREDENTIALS" });
    expect((await register(ada)).ok).toBe(true);
  });

  it.each([["{oops"], [JSON.stringify({ nope: 1 })]])(
    "treats bad session %s as absent",
    (raw) => {
      localStorage.setItem(SESSION_KEY, raw);
      expect(currentUser()).toBeNull();
    },
  );
});
