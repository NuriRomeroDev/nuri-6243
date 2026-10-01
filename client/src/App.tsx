import { useAuth } from "./auth/useAuth";
import { AuthScreen } from "./ui/AuthScreen";
import { Home } from "./ui/Home";

export function App() {
  const { user, register, login, logout } = useAuth();
  return (
    <main className="app">
      {user ? (
        <Home user={user} onLogout={logout} />
      ) : (
        <AuthScreen onRegister={register} onLogin={login} />
      )}
    </main>
  );
}
