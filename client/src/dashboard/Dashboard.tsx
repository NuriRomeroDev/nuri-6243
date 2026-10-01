import { useMemo } from "react";
import type { User } from "../auth/auth";
import {
  ArrowRightIcon,
  Brand,
  ChartIcon,
  LogoutIcon,
  TrophyIcon,
  WalletIcon,
} from "../ui/icons";
import { BarChart, DonutChart } from "./Charts";
import { RACES_PER_DAY, simulateDay } from "./stats";

export const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

type Props = { user: User; onLogout: () => void; onTopUp?: () => void };

export function Dashboard({ user, onLogout, onTopUp }: Props) {
  const stats = useMemo(() => simulateDay(user.id, new Date()), [user.id]);
  const firstName = user.fullName.trim().split(/\s+/)[0];
  return (
    <div className="dashboard">
      <header className="dash-header">
        <Brand />
        <div className="dash-user">
          <span className="greeting">
            Hola, {firstName} <span aria-hidden="true">👋</span>
          </span>
          <button type="button" className="logout" onClick={onLogout}>
            Cerrar sesión <LogoutIcon />
          </button>
        </div>
      </header>

      <section className="banner">
        <h2>¡Que siga la carrera!</h2>
        <p>Apuesta, compite y vive la emoción de las carreras de caracoles.</p>
      </section>

      <div className="dash-grid">
        <section className="panel balance-card">
          <h3>
            <WalletIcon /> Tu saldo
          </h3>
          <p className="amount">{usd.format(user.balanceCents / 100)}</p>
          <p className="caption">Listo para nuevas apuestas</p>
          <button
            type="button"
            className="primary"
            onClick={onTopUp}
            disabled={!onTopUp}
            title={onTopUp ? undefined : "Disponible pronto"}
          >
            Cargar saldo <ArrowRightIcon />
          </button>
        </section>

        <section className="panel">
          <h3>
            <ChartIcon /> Mis apuestas
          </h3>
          <DonutChart won={stats.bets.won} lost={stats.bets.lost} />
        </section>

        <section className="panel">
          <h3>
            <TrophyIcon /> Victorias del día
          </h3>
          <p className="caption">{RACES_PER_DAY} carreras simuladas hoy</p>
          <BarChart wins={stats.wins} />
        </section>
      </div>
    </div>
  );
}
