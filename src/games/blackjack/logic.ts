import { type Card, RANKS, type Rank, SUITS, shuffledDeck } from "../../shared/cards";
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
/**
 * Decides one hand. Call once both hands are final.
 * A split hand that makes 21 with two cards counts as 21, not blackjack.
 */
export function settle(player: readonly Card[], dealer: readonly Card[], fromSplit = false): Outcome {
  const p = handValue(player).total;
  const d = handValue(dealer).total;
  const pBj = !fromSplit && isBlackjack(player);
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

export interface Hand {
  cards: Card[];
  bet: number;
  doubled: boolean;
  /** No more cards for this hand (stood, doubled, bust, 21 or split aces). */
  done: boolean;
  fromSplit: boolean;
  outcome: Outcome | null;
}

/** Everything needed to resume a hand after a reload. */
export interface SavedTable {
  phase: Phase;
  hands: Hand[];
  active: number;
  dealer: Card[];
  shoe: Card[];
}

const sameValue = (a: Card, b: Card): boolean => VALUES[a.rank] === VALUES[b.rank];

export class Blackjack {
  phase: Phase = "betting";
  hands: Hand[] = [];
  /** Index of the hand you are playing. */
  active = 0;
  dealer: Card[] = [];
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

  /** The hand you are playing now (or the first hand once play is over). */
  get hand(): Hand | undefined {
    return this.hands[this.active] ?? this.hands[0];
  }

  /** Cards of the current hand. */
  get player(): Card[] {
    return this.hand?.cards ?? [];
  }

  /** Chips on the table across all hands. */
  get staked(): number {
    return this.hands.reduce((sum, h) => sum + h.bet, 0);
  }

  /** Net chips won or lost this round, once it is over. */
  get net(): number {
    return this.hands.reduce((sum, h) => sum + (h.outcome ? payout(h.outcome, h.bet) : 0), 0);
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
    const h = this.hand;
    return this.phase === "player" && !!h && !h.done && h.cards.length === 2 && this.chips >= this.staked + h.bet;
  }

  /** You can split two cards of the same value once, if you can cover a second bet. */
  canSplit(): boolean {
    const h = this.hand;
    if (this.phase !== "player" || !h || this.hands.length > 1 || h.cards.length !== 2) return false;
    const [a, b] = h.cards;
    return !!a && !!b && sameValue(a, b) && this.chips >= this.staked + h.bet;
  }

  /** Starts a round. Bets stay on the table until the round settles. */
  deal(bet: number): void {
    if (!this.canDeal(bet)) throw new Error("Can't deal now");
    const cards = [this.draw()];
    this.dealer = [this.draw()];
    cards.push(this.draw());
    this.dealer.push(this.draw());
    this.hands = [{ cards, bet, doubled: false, done: false, fromSplit: false, outcome: null }];
    this.active = 0;
    this.phase = "player";
    // A natural on either side ends the round at once.
    if (isBlackjack(cards) || isBlackjack(this.dealer)) this.settleAll();
  }

  hit(): Card {
    const h = this.hand;
    if (this.phase !== "player" || !h || h.done) throw new Error("Not your turn");
    const card = this.draw();
    h.cards.push(card);
    if (handValue(h.cards).total >= 21) this.finishHand();
    return card;
  }

  stand(): void {
    if (this.phase !== "player") throw new Error("Not your turn");
    this.finishHand();
  }

  /** Doubles this hand's bet, takes exactly one card, then stands. */
  double(): Card {
    const h = this.hand;
    if (!this.canDouble() || !h) throw new Error("Can't double now");
    h.bet *= 2;
    h.doubled = true;
    const card = this.draw();
    h.cards.push(card);
    this.finishHand();
    return card;
  }

  /** Splits a pair into two hands with one new card each. Split aces get one card only. */
  split(): void {
    const h = this.hand;
    if (!this.canSplit() || !h) throw new Error("Can't split now");
    const [a, b] = h.cards as [Card, Card];
    const aces = a.rank === "A";
    const make = (first: Card): Hand => ({
      cards: [first, this.draw()],
      bet: h.bet,
      doubled: false,
      done: aces,
      fromSplit: true,
      outcome: null,
    });
    this.hands = [make(a), make(b)];
    this.active = 0;
    for (const hand of this.hands) if (handValue(hand.cards).total === 21) hand.done = true;
    if (this.hands.every((x) => x.done)) this.afterPlayer();
    else if (this.hands[0]?.done) this.active = 1;
  }

  private finishHand(): void {
    const h = this.hand;
    if (h) h.done = true;
    const next = this.hands.findIndex((x) => !x.done);
    if (next !== -1) {
      this.active = next;
      return;
    }
    this.afterPlayer();
  }

  /** All hands are done: the dealer plays unless every hand is bust. */
  private afterPlayer(): void {
    this.active = 0;
    if (this.hands.every((x) => isBust(x.cards))) this.settleAll();
    else this.phase = "dealer";
  }

  /** Dealer draws one card if the rules say so. Returns null when the dealer is done (and settles). */
  dealerStep(): Card | null {
    if (this.phase !== "dealer") throw new Error("Not the dealer's turn");
    if (dealerShouldHit(this.dealer)) {
      const card = this.draw();
      this.dealer.push(card);
      return card;
    }
    this.settleAll();
    return null;
  }

  private settleAll(): void {
    for (const h of this.hands) {
      h.done = true;
      h.outcome = settle(h.cards, this.dealer, h.fromSplit);
      this.chips += payout(h.outcome, h.bet);
    }
    this.active = 0;
    this.phase = "done";
  }

  save(): SavedTable {
    return { phase: this.phase, hands: this.hands, active: this.active, dealer: this.dealer, shoe: this.shoe };
  }

  /** Restores a saved round. Returns false (and changes nothing) if the data isn't a valid table. */
  restore(data: unknown): boolean {
    const t = data as Partial<SavedTable> | null;
    if (!t || typeof t !== "object") return false;
    const phases: Phase[] = ["betting", "player", "dealer", "done"];
    if (!phases.includes(t.phase as Phase)) return false;
    const cards = (x: unknown): x is Card[] => Array.isArray(x) && x.every(isCard);
    if (!cards(t.dealer) || !cards(t.shoe) || !Array.isArray(t.hands) || t.hands.length > 2) return false;
    const hands: Hand[] = [];
    for (const raw of t.hands as unknown[]) {
      const h = raw as Partial<Hand>;
      if (!cards(h.cards) || typeof h.bet !== "number" || !Number.isInteger(h.bet) || h.bet <= 0) return false;
      hands.push({
        cards: h.cards,
        bet: h.bet,
        doubled: h.doubled === true,
        done: h.done === true,
        fromSplit: h.fromSplit === true,
        outcome: (["blackjack", "win", "lose", "push"] as const).find((o) => o === h.outcome) ?? null,
      });
    }
    const active = typeof t.active === "number" && t.active >= 0 && t.active < Math.max(hands.length, 1) ? t.active : 0;
    if ((t.phase === "player" || t.phase === "dealer") && hands.length === 0) return false;
    this.phase = t.phase as Phase;
    this.hands = hands;
    this.active = active;
    this.dealer = t.dealer;
    if (t.shoe.length > 0) this.shoe = t.shoe;
    return true;
  }
}

function isCard(x: unknown): x is Card {
  const c = x as Partial<Card> | null;
  return !!c && (SUITS as readonly string[]).includes(c.suit as string) && (RANKS as readonly string[]).includes(c.rank as string);
}
