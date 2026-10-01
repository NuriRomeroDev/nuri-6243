import { useAuth } from "./auth/useAuth";
import { AuthScreen } from "./ui/AuthScreen";
import { Dashboard } from "./dashboard/Dashboard";

export function App() {
  const { user, register, login, logout } = useAuth();
  return (
    <main className="app">
      {user ? (
        <Dashboard user={user} onLogout={logout} />
      ) : (
        <AuthScreen onRegister={register} onLogin={login} />
      )}
    </main>
  );
}
