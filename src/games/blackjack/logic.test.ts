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
    expect(settle(hand("A", "K"), hand("10", "9"), true)).toBe("win");
  });

  it("blackjack pays 3 to 2", () => {
    expect(payout("blackjack", 10)).toBe(15);
    expect(payout("win", 10)).toBe(10);
    expect(payout("lose", 10)).toBe(-10);
    expect(payout("push", 10)).toBe(0);
  });
});

describe("Blackjack game", () => {
  const playOut = (game: Blackjack): void => {
    while (game.phase === "player") {
      if (handValue(game.player).total < 17) game.hit();
      else game.stand();
    }
    while (game.phase === "dealer") game.dealerStep();
  };

  it("plays rounds to the end and keeps chips consistent", () => {
    const game = new Blackjack(1000, seededRng(42));
    for (let i = 0; i < 300; i++) {
      const before = game.chips;
      game.deal(10);
      if (game.canSplit() && i % 2 === 0) game.split();
      playOut(game);
      expect(game.phase).toBe("done");
      expect(game.hands.every((h) => h.outcome !== null)).toBe(true);
      expect(game.chips - before).toBe(game.net);
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
    expect(game.hands[0]!.cards).toHaveLength(3);
    expect(game.hands[0]!.bet).toBe(20);
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

describe("split", () => {
  /** A game whose shoe deals these cards in order: you, dealer, you, dealer, then hits. */
  function rigged(ranks: Rank[], chips = 100): Blackjack {
    const game = new Blackjack(chips, seededRng(1));
    // draw() takes from the end of the shoe, so the first card goes last. 60 filler cards keep it above the reshuffle point.
    const filler = hand(...(Array(60).fill("2") as Rank[]));
    game.restore({ phase: "betting", hands: [], active: 0, dealer: [], shoe: [...filler, ...hand(...ranks).reverse()] });
    return game;
  }

  it("splits a pair into two hands that play in turn", () => {
    const game = rigged(["8", "10", "8", "7", "3", "K"]);
    game.deal(10);
    expect(game.canSplit()).toBe(true);
    game.split();
    expect(game.hands).toHaveLength(2);
    expect(game.hands.map((h) => h.cards.map((c) => c.rank))).toEqual([["8", "3"], ["8", "K"]]);
    expect(game.active).toBe(0);
    game.stand();
    expect(game.active).toBe(1);
    game.stand();
    expect(game.phase).toBe("dealer");
    while (game.phase === "dealer") game.dealerStep();
    expect(game.hands.map((h) => h.outcome)).toEqual(["lose", "win"]);
    expect(game.chips).toBe(100);
  });

  it("needs a pair and enough chips, and only once", () => {
    const game = rigged(["8", "10", "9", "7"]);
    game.deal(10);
    expect(game.canSplit()).toBe(false);
    const poor = rigged(["8", "10", "8", "7"], 15);
    poor.deal(10);
    expect(poor.canSplit()).toBe(false);
    const tens = rigged(["K", "10", "Q", "7", "2", "3"]);
    tens.deal(10);
    expect(tens.canSplit()).toBe(true);
    tens.split();
    expect(tens.canSplit()).toBe(false);
  });

  it("split aces get one card each and 21 is not blackjack", () => {
    const game = rigged(["A", "10", "A", "7", "K", "5"]);
    game.deal(10);
    game.split();
    expect(game.hands.every((h) => h.done && h.cards.length === 2)).toBe(true);
    expect(game.phase).toBe("dealer");
    while (game.phase === "dealer") game.dealerStep();
    expect(game.hands[0]!.outcome).toBe("win");
    expect(game.net).toBe(10 + payout(game.hands[1]!.outcome!, 10));
  });

  it("you can double after splitting", () => {
    const game = rigged(["5", "10", "5", "7", "6", "9", "K", "2"]);
    game.deal(10);
    game.split();
    expect(game.canDouble()).toBe(true);
    game.double();
    expect(game.hands[0]!.bet).toBe(20);
    expect(game.active).toBe(1);
  });
});

describe("save and restore", () => {
  it("resumes a hand mid-round", () => {
    const game = new Blackjack(100, seededRng(8));
    let tries = 0;
    do game.deal(10);
    while (game.phase !== "player" && ++tries < 50);
    const saved = JSON.parse(JSON.stringify(game.save()));
    const again = new Blackjack(100, seededRng(99));
    expect(again.restore(saved)).toBe(true);
    expect(again.phase).toBe("player");
    expect(again.player).toEqual(game.player);
    expect(again.dealer).toEqual(game.dealer);
    expect(again.cardsLeft).toBe(game.cardsLeft);
  });

  it("rejects broken data", () => {
    const game = new Blackjack(100, seededRng(8));
    expect(game.restore(null)).toBe(false);
    expect(game.restore({ phase: "player", hands: [], active: 0, dealer: [], shoe: [] })).toBe(false);
    expect(game.restore({ phase: "nope", hands: [], active: 0, dealer: [], shoe: [] })).toBe(false);
    expect(game.restore({ phase: "player", hands: [{ cards: [{ rank: "Z", suit: "spades" }], bet: 10 }], active: 0, dealer: [], shoe: [] })).toBe(false);
    expect(game.restore({ phase: "player", hands: [{ cards: [], bet: -5 }], active: 0, dealer: [], shoe: [] })).toBe(false);
  });
});
