import { describe, expect, it } from "vitest";
import type { Card } from "../../shared/cards";
import { createDeck } from "../../shared/cards";
import { seededRng } from "../../shared/rng";
import { HigherOrLower, odds, rankValue } from "./logic";

const c = (rank: Card["rank"]): Card => ({ rank, suit: "clubs" });

describe("odds", () => {
  it("aces are high", () => {
    expect(rankValue("A")).toBe(14);
    expect(rankValue("2")).toBe(2);
    expect(rankValue("K")).toBeGreaterThan(rankValue("Q"));
  });

  it("matches a full deck by hand", () => {
    const deck = createDeck().filter((x) => !(x.rank === "7" && x.suit === "clubs"));
    const o = odds(c("7"), deck);
    expect(o.higher).toBeCloseTo(28 / 51);
    expect(o.lower).toBeCloseTo(20 / 51);
    expect(o.same).toBeCloseTo(3 / 51);
    expect(o.higher + o.lower + o.same).toBeCloseTo(1);
  });

  it("knows a sure thing", () => {
    expect(odds(c("2"), [c("5"), c("K")]).higher).toBe(1);
  });
});

describe("HigherOrLower", () => {
  it("always calling the better side builds streaks, and a wrong call ends the run", () => {
    let best = 0;
    for (let seed = 0; seed < 50; seed++) {
      const game = new HigherOrLower(seededRng(seed));
      while (!game.over) {
        const o = game.odds;
        const before = game.streak;
        const { result } = game.call(o.higher >= o.lower ? "higher" : "lower");
        if (result === "right") expect(game.streak).toBe(before + 1);
        if (result === "tie") expect(game.streak).toBe(before);
        if (game.streak > 200) break;
      }
      best = Math.max(best, game.streak);
    }
    expect(best).toBeGreaterThan(3);
  });

  it("keeps going past the end of the deck", () => {
    const game = new HigherOrLower(seededRng(1));
    game.deck = [c("9")];
    game.current = c("5");
    expect(game.call("higher").result).toBe("right");
    expect(game.deck.length).toBe(0);
    game.call("lower");
    expect(game.deck.length).toBe(50);
  });
});
