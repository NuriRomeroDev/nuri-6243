import { useState } from "react";
import * as auth from "./auth";
import type { AuthResult, User } from "./auth";
import type { ChargeResponse } from "../topup/snailpay";

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
    applyCharge: (response: ChargeResponse) => {
      if (user) setUser(auth.recordCharge(user.id, response));
    },
    logout: () => {
      auth.logout();
      setUser(null);
    },
  };
}
