import { useState } from "react";
import { useAuth } from "./auth/useAuth";
import { AuthScreen } from "./ui/AuthScreen";
import { Dashboard } from "./dashboard/Dashboard";
import { TopUpDialog } from "./topup/TopUpDialog";

export function App() {
  const { user, register, login, logout, applyCharge } = useAuth();
  const [topUpOpen, setTopUpOpen] = useState(false);
  return (
    <main className="app">
      {user ? (
        <>
          <Dashboard
            user={user}
            onLogout={logout}
            onTopUp={() => setTopUpOpen(true)}
          />
          {/* Mounted only while open so every opening starts from a clean form. */}
          {topUpOpen && (
            <TopUpDialog
              user={user}
              onCharge={applyCharge}
              onClose={() => setTopUpOpen(false)}
            />
          )}
        </>
      ) : (
        <AuthScreen onRegister={register} onLogin={login} />
      )}
    </main>
  );
}
