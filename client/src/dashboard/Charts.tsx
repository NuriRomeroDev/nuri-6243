import { SNAILS, type SnailId } from "./stats";

const R = 48;
const C = 2 * Math.PI * R;

export const percent = (part: number, total: number) =>
  total ? ((part / total) * 100).toFixed(1) : "0.0";

export function DonutChart({ won, lost }: { won: number; lost: number }) {
  const total = won + lost;
  const wonLen = total ? (won / total) * C : 0;
  return (
    <figure className="chart donut" aria-label="Apuestas ganadas y perdidas">
      <div className="donut-visual" aria-hidden="true">
        <svg viewBox="0 0 120 120">
          <g transform="rotate(-90 60 60)" fill="none" strokeWidth="16">
            <circle cx="60" cy="60" r={R} stroke="#EF685E" />
            <circle
              cx="60"
              cy="60"
              r={R}
              stroke="#58B947"
              strokeDasharray={`${wonLen} ${C}`}
            />
          </g>
        </svg>
        <div className="donut-center">
          <strong>{total}</strong>
          <span>Total</span>
        </div>
      </div>
      <figcaption className="sr-only">{total} apuestas en total</figcaption>
      <ul className="legend">
        <li>
          <i style={{ background: "#58B947" }} aria-hidden="true" />
          <strong>{won} ganadas</strong>
          <span>{percent(won, total)}%</span>
        </li>
        <li>
          <i style={{ background: "#EF685E" }} aria-hidden="true" />
          <strong>{lost} perdidas</strong>
          <span>{percent(lost, total)}%</span>
        </li>
      </ul>
    </figure>
  );
}

export function BarChart({ wins }: { wins: Record<SnailId, number> }) {
  const max = Math.max(3, ...Object.values(wins));
  const ticks = Array.from({ length: max + 1 }, (_, i) => max - i);
  return (
    <figure className="chart bars" aria-label="Victorias por caracol">
      <div className="bars-visual" aria-hidden="true">
        <div className="bars-axis">
          {ticks.map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
        <div className="bars-cols">
          {SNAILS.map(({ id, name, color }) => (
            <div className="bar-col" key={id}>
              <div className="bar-track">
                <strong>{wins[id]}</strong>
                <div
                  className="bar"
                  style={{
                    height: `${(wins[id] / max) * 100}%`,
                    background: color,
                  }}
                />
              </div>
              <img src={new URL(`../assets/snails/${id}.webp`, import.meta.url).href} alt="" />
              <span>{name}</span>
            </div>
          ))}
        </div>
      </div>
      <table className="sr-only">
        <thead>
          <tr>
            <th>Caracol</th>
            <th>Victorias</th>
          </tr>
        </thead>
        <tbody>
          {SNAILS.map(({ id, name }) => (
            <tr key={id}>
              <td>{name}</td>
              <td>{wins[id]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
