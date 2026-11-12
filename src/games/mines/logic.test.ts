import { describe, expect, it } from "vitest";
import { seededRng } from "../../shared/rng";
import { MinesRound, SIZE, multiplier, safeChance } from "./logic";

describe("multiplier", () => {
  it("is fair: chance of surviving times multiplier is 1", () => {
    for (const mines of [3, 5, 10]) {
      let survive = 1;
      for (let safe = 0; safe < SIZE - mines; safe++) {
        survive *= safeChance(mines, safe);
        expect(survive * multiplier(mines, safe + 1)).toBeCloseTo(1, 10);
      }
    }
  });

  it("starts at 1x and grows", () => {
    expect(multiplier(3, 0)).toBe(1);
    expect(multiplier(3, 1)).toBeCloseTo(25 / 22);
    expect(multiplier(10, 2)).toBeGreaterThan(multiplier(3, 2));
  });
});

describe("MinesRound", () => {
  it("places the requested number of mines", () => {
    const r = new MinesRound(5, 10, seededRng(1));
    expect(r.mineAt.size).toBe(5);
  });

  it("busts on a mine and cashes out otherwise", () => {
    const r = new MinesRound(3, 10, seededRng(2));
    const safe = [...Array(SIZE).keys()].filter((i) => !r.mineAt.has(i));
    expect(() => r.cashOut()).toThrow();
    r.reveal(safe[0]!);
    r.reveal(safe[1]!);
    expect(r.payout).toBe(Math.floor(10 * r.multiplier));
    expect(r.cashOut()).toBeGreaterThan(10);
    expect(() => r.reveal(safe[2]!)).toThrow();

    const r2 = new MinesRound(3, 10, seededRng(2));
    expect(r2.reveal([...r2.mineAt][0]!)).toBe("mine");
    expect(r2.status).toBe("busted");
  });

  it("clearing every safe tile ends the round as a win", () => {
    const r = new MinesRound(10, 10, seededRng(3));
    for (let i = 0; i < SIZE; i++) if (!r.mineAt.has(i)) r.reveal(i);
    expect(r.status).toBe("cashed");
    expect(r.cleared).toBe(true);
  });

  it("rejects repeat picks", () => {
    const r = new MinesRound(3, 10, seededRng(4));
    const safe = [...Array(SIZE).keys()].find((i) => !r.mineAt.has(i))!;
    r.reveal(safe);
    expect(() => r.reveal(safe)).toThrow();
  });
});
