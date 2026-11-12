import { type Card, type Rank, shuffledDeck } from "../../shared/cards";
import { type Rng, cryptoRng } from "../../shared/rng";

export const DECKS = 4;
/** Reshuffle when fewer than this many cards are left in the shoe. */
export const RESHUFFLE_AT = 52;
export const BETS = [5, 10, 25, 50] as const;
export const STARTING_CHIPS = 100;

export type Phase = "betting" | "player" | "dealer" | "done";
export type Outcome = "blackjack" | "win" | "lose" | "push";

const VALUES: Record<Rank, number> = {
  A: 11, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9, "10": 10, J: 10, Q: 10, K: 10,
};

/** Best total for a hand. `soft` means an ace is still counted as 11. */
export function handValue(cards: readonly Card[]): { total: number; soft: boolean } {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    total += VALUES[c.rank];
    if (c.rank === "A") aces++;
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return { total, soft: aces > 0 };
}

export function isBlackjack(cards: readonly Card[]): boolean {
  return cards.length === 2 && handValue(cards).total === 21;
}

export function isBust(cards: readonly Card[]): boolean {
  return handValue(cards).total > 21;
}

/** Dealer stands on all 17s, including soft 17. */
export function dealerShouldHit(cards: readonly Card[]): boolean {
  return handValue(cards).total < 17;
}

/** Decides the hand. Call once both hands are final. */
export function settle(player: readonly Card[], dealer: readonly Card[]): Outcome {
  const p = handValue(player).total;
  const d = handValue(dealer).total;
  const pBj = isBlackjack(player);
  const dBj = isBlackjack(dealer);
  if (pBj && dBj) return "push";
  if (pBj) return "blackjack";
  if (dBj) return "lose";
  if (p > 21) return "lose";
  if (d > 21) return "win";
  if (p > d) return "win";
  if (p < d) return "lose";
  return "push";
}

/** Net chips won or lost. Blackjack pays 3 to 2. */
export function payout(outcome: Outcome, bet: number): number {
  switch (outcome) {
    case "blackjack":
      return Math.floor(bet * 1.5);
    case "win":
      return bet;
    case "lose":
      return -bet;
    case "push":
      return 0;
  }
}

export class Blackjack {
  phase: Phase = "betting";
  player: Card[] = [];
  dealer: Card[] = [];
  bet = 0;
  doubled = false;
  outcome: Outcome | null = null;
  private shoe: Card[] = [];

  constructor(
    public chips: number = STARTING_CHIPS,
    private readonly rng: Rng = cryptoRng,
  ) {
    this.shoe = shuffledDeck(DECKS, rng);
  }

  get cardsLeft(): number {
    return this.shoe.length;
  }

  private draw(): Card {
    if (this.shoe.length < RESHUFFLE_AT) this.shoe = shuffledDeck(DECKS, this.rng);
    const card = this.shoe.pop();
    if (!card) throw new Error("Shoe is empty");
    return card;
  }

  canDeal(bet: number): boolean {
    return (this.phase === "betting" || this.phase === "done") && bet > 0 && bet <= this.chips;
  }

  canDouble(): boolean {
    return this.phase === "player" && this.player.length === 2 && this.chips >= this.bet * 2;
  }

  /** Starts a hand. The bet is held until the hand settles. */
  deal(bet: number): void {
    if (!this.canDeal(bet)) throw new Error("Can't deal now");
    this.bet = bet;
    this.doubled = false;
    this.outcome = null;
    this.player = [this.draw()];
    this.dealer = [this.draw()];
    this.player.push(this.draw());
    this.dealer.push(this.draw());
    this.phase = "player";
    // A natural on either side ends the hand at once.
    if (isBlackjack(this.player) || isBlackjack(this.dealer)) this.finish();
  }

  hit(): Card {
    if (this.phase !== "player") throw new Error("Not your turn");
    const card = this.draw();
    this.player.push(card);
    const { total } = handValue(this.player);
    if (total > 21) this.finish();
    else if (total === 21) this.phase = "dealer";
    return card;
  }

  stand(): void {
    if (this.phase !== "player") throw new Error("Not your turn");
    this.phase = "dealer";
  }

  /** Doubles the bet, takes exactly one card, then stands. */
  double(): Card {
    if (!this.canDouble()) throw new Error("Can't double now");
    this.bet *= 2;
    this.doubled = true;
    const card = this.draw();
    this.player.push(card);
    if (isBust(this.player)) this.finish();
    else this.phase = "dealer";
    return card;
  }

  /** Dealer draws one card if the rules say so. Returns null when the dealer is done (and settles). */
  dealerStep(): Card | null {
    if (this.phase !== "dealer") throw new Error("Not the dealer's turn");
    if (dealerShouldHit(this.dealer)) {
      const card = this.draw();
      this.dealer.push(card);
      return card;
    }
    this.finish();
    return null;
  }

  private finish(): void {
    this.outcome = settle(this.player, this.dealer);
    this.chips += payout(this.outcome, this.bet);
    this.phase = "done";
  }
}
