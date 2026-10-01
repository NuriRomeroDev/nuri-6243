export const SNAILS = [
  { id: "turbo", name: "Turbo", color: "#58B947" },
  { id: "rocket", name: "Rocket", color: "#EF685E" },
  { id: "shelby", name: "Shelby", color: "#3A78D2" },
  { id: "lightning", name: "Lightning", color: "#8E66E8" },
  { id: "mango", name: "Mango", color: "#F2C94C" },
  { id: "gary", name: "Gary", color: "#9FA3A8" },
] as const;

export type SnailId = (typeof SNAILS)[number]["id"];

export const RACES_PER_DAY = 6;

// FNV-1a: string -> 32-bit seed.
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  }
  return h >>> 0;
}

// mulberry32: small seeded PRNG returning floats in [0, 1).
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Deterministic fake results for a user on a local calendar day. */
export function simulateDay(userId: string, date: Date) {
  const key = `${userId}:${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const rand = mulberry32(hash(key));
  const races = Array.from(
    { length: RACES_PER_DAY },
    () => SNAILS[Math.floor(rand() * SNAILS.length)].id,
  );
  const wins = Object.fromEntries(SNAILS.map((s) => [s.id, 0])) as Record<
    SnailId,
    number
  >;
  for (const winner of races) wins[winner]++;
  const total = 10 + Math.floor(rand() * 21);
  const won = Math.floor(rand() * (total + 1));
  return { races, wins, bets: { won, lost: total - won } };
}
