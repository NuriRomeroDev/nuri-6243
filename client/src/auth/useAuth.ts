import { useState } from "react";
import * as auth from "./auth";
import type { AuthResult, User } from "./auth";
import type { ChargeResult } from "../topup/snailpay";

export function useAuth() {
  const [user, setUser] = useState<User | null>(auth.currentUser);

  const settle = (result: AuthResult) => {
    if (result.ok) setUser(result.user);
    return result;
  };

  return {
    user,
    register: async (input: Parameters<typeof auth.register>[0]) =>
      settle(await auth.register(input)),
    login: async (email: string, password: string) =>
      settle(await auth.login(email, password)),
    applyCharge: (result: ChargeResult) => {
      if (user && "response" in result && result.response)
        setUser(
          auth.recordCharge(user.id, result.response, {
            credit: result.kind === "approved",
          }),
        );
    },
    logout: () => {
      auth.logout();
      setUser(null);
    },
  };
}
