import { describe, expect, it } from "vitest";
import { RACES_PER_DAY, SNAILS, simulateDay } from "./stats";

const ids = SNAILS.map((s) => s.id) as string[];
const day = (offset: number) => new Date(2026, 0, 1 + offset, 15, 30);

describe("simulateDay", () => {
  it("is deterministic for the same user and local date", () => {
    expect(simulateDay("u1", new Date(2026, 5, 1, 8))).toEqual(
      simulateDay("u1", new Date(2026, 5, 1, 22)),
    );
  });

  it("differs across dates and users", () => {
    const base = simulateDay("u1", day(0));
    const dates = Array.from({ length: 10 }, (_, i) =>
      simulateDay("u1", day(i + 1)),
    );
    const users = Array.from({ length: 10 }, (_, i) =>
      simulateDay(`user-${i}`, day(0)),
    );
    expect(dates.some((d) => d.races.join() !== base.races.join())).toBe(true);
    expect(users.some((d) => d.races.join() !== base.races.join())).toBe(true);
  });

  it("keeps its invariants over many seeds", () => {
    for (let i = 0; i < 200; i++) {
      const { races, wins, bets } = simulateDay(`user-${i % 7}`, day(i));
      expect(races).toHaveLength(RACES_PER_DAY);
      for (const winner of races) expect(ids).toContain(winner);
      expect(Object.keys(wins).sort()).toEqual([...ids].sort());
      for (const id of ids)
        expect(wins[id as keyof typeof wins]).toBe(
          races.filter((r) => r === id).length,
        );
      expect(Object.values(wins).reduce((a, b) => a + b, 0)).toBe(6);
      const total = bets.won + bets.lost;
      expect(total).toBeGreaterThanOrEqual(10);
      expect(total).toBeLessThanOrEqual(30);
      expect(bets.won).toBeGreaterThanOrEqual(0);
      expect(bets.lost).toBeGreaterThanOrEqual(0);
    }
  });
});
