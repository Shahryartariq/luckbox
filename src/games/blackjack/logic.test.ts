import { describe, expect, it } from "vitest";
import type { Card, Rank } from "../../shared/cards";
import { seededRng } from "../../shared/rng";
import { Blackjack, dealerShouldHit, handValue, isBlackjack, payout, settle } from "./logic";

const hand = (...ranks: Rank[]): Card[] => ranks.map((rank) => ({ rank, suit: "spades" }));

describe("handValue", () => {
  it("counts aces as 11 until that would bust", () => {
    expect(handValue(hand("A", "6"))).toEqual({ total: 17, soft: true });
    expect(handValue(hand("A", "6", "10"))).toEqual({ total: 17, soft: false });
    expect(handValue(hand("A", "A", "9"))).toEqual({ total: 21, soft: true });
    expect(handValue(hand("A", "A", "A", "A"))).toEqual({ total: 14, soft: true });
    expect(handValue(hand("K", "Q", "2"))).toEqual({ total: 22, soft: false });
    expect(handValue(hand("10", "J"))).toEqual({ total: 20, soft: false });
  });

  it("deals the 10 card (the old version never did)", () => {
    expect(handValue(hand("10", "9")).total).toBe(19);
  });
});

describe("rules", () => {
  it("blackjack is exactly two cards worth 21", () => {
    expect(isBlackjack(hand("A", "K"))).toBe(true);
    expect(isBlackjack(hand("7", "7", "7"))).toBe(false);
  });

  it("dealer hits 16 and stands on every 17, soft or hard", () => {
    expect(dealerShouldHit(hand("10", "6"))).toBe(true);
    expect(dealerShouldHit(hand("10", "7"))).toBe(false);
    expect(dealerShouldHit(hand("A", "6"))).toBe(false);
  });

  it("settles hands", () => {
    expect(settle(hand("A", "K"), hand("10", "9"))).toBe("blackjack");
    expect(settle(hand("A", "K"), hand("A", "Q"))).toBe("push");
    expect(settle(hand("10", "9", "2"), hand("A", "Q"))).toBe("lose");
    expect(settle(hand("10", "6", "9"), hand("10", "6", "9"))).toBe("lose");
    expect(settle(hand("10", "8"), hand("10", "6", "9"))).toBe("win");
    expect(settle(hand("10", "8"), hand("10", "8"))).toBe("push");
    expect(settle(hand("10", "7"), hand("10", "8"))).toBe("lose");
  });

  it("blackjack pays 3 to 2", () => {
    expect(payout("blackjack", 10)).toBe(15);
    expect(payout("win", 10)).toBe(10);
    expect(payout("lose", 10)).toBe(-10);
    expect(payout("push", 10)).toBe(0);
  });
});

describe("Blackjack game", () => {
  it("plays hands to the end and keeps chips consistent", () => {
    const game = new Blackjack(1000, seededRng(42));
    for (let i = 0; i < 300; i++) {
      const before = game.chips;
      game.deal(10);
      while (game.phase === "player") {
        if (handValue(game.player).total < 17) game.hit();
        else game.stand();
      }
      while (game.phase === "dealer") game.dealerStep();
      expect(game.phase).toBe("done");
      expect(game.outcome).not.toBeNull();
      expect(game.chips - before).toBe(payout(game.outcome!, game.bet));
    }
  });

  it("double takes one card and doubles the bet", () => {
    const game = new Blackjack(100, seededRng(3));
    let tries = 0;
    do {
      game.deal(10);
      tries++;
    } while (game.phase !== "player" && tries < 50);
    expect(game.canDouble()).toBe(true);
    game.double();
    expect(game.player).toHaveLength(3);
    expect(game.bet).toBe(20);
    expect(["dealer", "done"]).toContain(game.phase);
  });

  it("won't deal more than you have", () => {
    const game = new Blackjack(5, seededRng(1));
    expect(game.canDeal(10)).toBe(false);
    expect(() => game.deal(10)).toThrow();
  });

  it("reshuffles before the shoe runs out", () => {
    const game = new Blackjack(1_000_000, seededRng(9));
    for (let i = 0; i < 400; i++) {
      game.deal(5);
      while (game.phase === "player") game.stand();
      while (game.phase === "dealer") game.dealerStep();
      expect(game.cardsLeft).toBeGreaterThan(0);
    }
  });
});
