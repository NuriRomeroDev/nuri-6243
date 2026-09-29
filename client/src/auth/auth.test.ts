import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  USERS_KEY,
  SESSION_KEY,
  currentUser,
  login,
  logout,
  register,
} from "./auth";
import { PBKDF2_ITERATIONS, verifyPassword } from "./password";

vi.mock("./password", async (importOriginal) => {
  const real = await importOriginal<typeof import("./password")>();
  return {
    ...real,
    hashPassword: (pw: string) => real.hashPassword(pw, 1),
    verifyPassword: vi.fn(real.verifyPassword),
  };
});

const ada = {
  fullName: "Ada Lovelace",
  email: "Ada@Example.com",
  password: "secret123",
};
const users = () => JSON.parse(localStorage.getItem(USERS_KEY) ?? "{}");

beforeEach(() => {
  vi.mocked(verifyPassword).mockClear();
});

describe("register", () => {
  it("stores a normalized user, hashes the password and logs in", async () => {
    const result = await register(ada);
    expect(result).toMatchObject({
      ok: true,
      user: {
        fullName: "Ada Lovelace",
        email: "ada@example.com",
        balanceCents: 0,
      },
    });
    expect(users()["ada@example.com"].password.algorithm).toBe("PBKDF2-SHA256");
    expect(currentUser()?.email).toBe("ada@example.com");
    expect(JSON.stringify(localStorage)).not.toContain("secret123");
    if (result.ok) expect(result.user).not.toHaveProperty("password");
  });

  it("rejects a duplicate email in any case and leaves the record unchanged", async () => {
    await register(ada);
    const before = localStorage.getItem(USERS_KEY);
    const result = await register({
      ...ada,
      email: " ADA@example.COM ",
      fullName: "Other",
    });
    expect(result).toEqual({ ok: false, error: "EMAIL_TAKEN" });
    expect(localStorage.getItem(USERS_KEY)).toBe(before);
  });

  it("propagates storage failures", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementationOnce(() => {
      throw new Error("quota");
    });
    await expect(register(ada)).rejects.toThrow("quota");
  });

  it("can be retried after the session write fails", async () => {
    const setItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (
      this: Storage,
      key,
      value,
    ) {
      if (key === SESSION_KEY) throw new Error("quota");
      setItem.call(this, key, value);
    });
    await expect(register(ada)).rejects.toThrow("quota");
    vi.mocked(Storage.prototype.setItem).mockRestore();
    expect((await register(ada)).ok).toBe(true);
  });

  it("keeps existing accounts when another record is corrupt", async () => {
    await register(ada);
    logout();
    const raw = users();
    localStorage.setItem(
      USERS_KEY,
      JSON.stringify({ ...raw, "bad@b.co": { id: 1 } }),
    );
    const bob = {
      fullName: "Bob",
      email: "bob@example.com",
      password: "secret123",
    };
    expect((await register(bob)).ok).toBe(true);
    expect(Object.keys(users()).sort()).toEqual([
      "ada@example.com",
      "bob@example.com",
    ]);
    logout();
    expect((await login(ada.email, ada.password)).ok).toBe(true);
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

  it.each([
    ["zero iterations", { iterations: 0 }],
    ["negative iterations", { iterations: -1 }],
    ["fractional iterations", { iterations: 1.5 }],
    ["huge iterations", { iterations: 1e9 }],
    ["non-base64 salt", { salt: "!!!" }],
    ["non-base64 hash", { hash: "not base64" }],
  ])("treats a stored user with %s as unknown", async (_, patch) => {
    const all = users();
    all["ada@example.com"].password = {
      ...all["ada@example.com"].password,
      ...patch,
    };
    localStorage.setItem(USERS_KEY, JSON.stringify(all));
    expect(await login("ada@example.com", "secret123")).toEqual({
      ok: false,
      error: "INVALID_CREDENTIALS",
    });
  });

  it("still verifies against a dummy hash for an unknown email", async () => {
    await login("ghost@example.com", "nope");
    expect(verifyPassword).toHaveBeenCalledTimes(1);
    expect(vi.mocked(verifyPassword).mock.calls[0]?.[1].iterations).toBe(
      PBKDF2_ITERATIONS,
    );
  });
});

describe("session", () => {
  it("logout removes the session", async () => {
    await register(ada);
    logout();
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
    expect(currentUser()).toBeNull();
  });

  it("survives removeItem failing while clearing an orphan session", () => {
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ userId: "x", createdAt: "now" }),
    );
    vi.spyOn(Storage.prototype, "removeItem").mockImplementationOnce(() => {
      throw new Error("denied");
    });
    expect(currentUser()).toBeNull();
  });

  it("clears an orphan session", () => {
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ userId: "x", createdAt: "now" }),
    );
    expect(currentUser()).toBeNull();
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
  });

  it.each([
    ["corrupted JSON", "{not json"],
    ["wrong shape", JSON.stringify({ "a@b.co": { id: 1 } })],
    ["array", "[]"],
  ])("treats %s users data as empty", async (_, raw) => {
    localStorage.setItem(USERS_KEY, raw);
    expect(await login("a@b.co", "x")).toEqual({
      ok: false,
      error: "INVALID_CREDENTIALS",
    });
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
