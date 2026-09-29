import type { User } from "../auth/auth";

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export function Home({ user, onLogout }: { user: User; onLogout: () => void }) {
  return (
    <section className="card">
      <h2>Welcome, {user.fullName}</h2>
      <p className="balance-label">Balance</p>
      <p className="balance">{usd.format(user.balanceCents / 100)}</p>
      <button type="button" onClick={onLogout}>
        Log out
      </button>
    </section>
  );
}
