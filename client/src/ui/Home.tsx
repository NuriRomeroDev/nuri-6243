import { Brand } from "./icons";
import type { User } from "../auth/auth";

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export function Home({ user, onLogout }: { user: User; onLogout: () => void }) {
  return (
    <section className="card">
      <Brand />
      <h2>Hola, {user.fullName}</h2>
      <p className="balance-label">Saldo</p>
      <p className="balance">{usd.format(user.balanceCents / 100)}</p>
      <button type="button" className="primary" onClick={onLogout}>
        Cerrar sesión
      </button>
    </section>
  );
}
