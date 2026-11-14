import { type Card, RANKS, type Rank, SUITS, createDeck, shuffledDeck } from "../../shared/cards";
import { type Rng, cryptoRng, shuffle } from "../../shared/rng";

export type Call = "higher" | "lower";
export type CallResult = "right" | "wrong" | "tie";

/** Aces are high in this game: 2 is lowest, A is highest. */
export function rankValue(rank: Rank): number {
  return rank === "A" ? 14 : rank === "K" ? 13 : rank === "Q" ? 12 : rank === "J" ? 11 : Number(rank);
}

export interface Odds {
  higher: number;
  lower: number;
  same: number;
}

/** Chance (0 to 1) that the next card from `remaining` is higher, lower or the same rank. */
export function odds(current: Card, remaining: readonly Card[]): Odds {
  if (remaining.length === 0) return { higher: 0, lower: 0, same: 0 };
  const v = rankValue(current.rank);
  let higher = 0;
  let lower = 0;
  for (const c of remaining) {
    const cv = rankValue(c.rank);
    if (cv > v) higher++;
    else if (cv < v) lower++;
  }
  const n = remaining.length;
  return { higher: higher / n, lower: lower / n, same: (n - higher - lower) / n };
}

export class HigherOrLower {
  current: Card;
  deck: Card[];
  streak = 0;
  over = false;
  /** Cards seen this run, oldest first, including the current one. */
  history: Card[];

  constructor(private readonly rng: Rng = cryptoRng) {
    this.deck = shuffledDeck(1, rng);
    this.current = this.take();
    this.history = [this.current];
  }

  private take(): Card {
    const card = this.deck.pop();
    if (!card) throw new Error("Deck is empty");
    return card;
  }

  /** Cards the next draw can come from: the deck, or a fresh deck once it runs out. */
  private nextPool(): Card[] {
    if (this.deck.length > 0) return this.deck;
    return createDeck().filter((c) => !(c.rank === this.current.rank && c.suit === this.current.suit));
  }

  get odds(): Odds {
    return odds(this.current, this.nextPool());
  }

  /** Cards left before the next reshuffle (51 right after one). */
  get cardsLeft(): number {
    return this.nextPool().length;
  }

  save(): { deck: Card[]; current: Card; streak: number; over: boolean; history: Card[] } {
    return { deck: this.deck, current: this.current, streak: this.streak, over: this.over, history: this.history.slice(-8) };
  }

  /** Restores a saved run. Returns false (and changes nothing) for invalid data. */
  restore(data: unknown): boolean {
    const d = data as Partial<ReturnType<HigherOrLower["save"]>> | null;
    const isCard = (x: unknown): x is Card => {
      const c = x as Partial<Card> | null;
      return !!c && (RANKS as readonly string[]).includes(c.rank as string) && (SUITS as readonly string[]).includes(c.suit as string);
    };
    if (!d || !Array.isArray(d.deck) || !d.deck.every(isCard) || d.deck.length > 51 || !isCard(d.current)) return false;
    if (typeof d.streak !== "number" || !Number.isInteger(d.streak) || d.streak < 0 || typeof d.over !== "boolean") return false;
    const history = Array.isArray(d.history) && d.history.every(isCard) ? d.history : [d.current];
    this.deck = d.deck;
    this.current = d.current;
    this.streak = d.streak;
    this.over = d.over;
    this.history = history;
    return true;
  }

  /** Makes a call, flips the next card and returns what happened. A tie keeps the run going. */
  call(guess: Call): { card: Card; result: CallResult } {
    if (this.over) throw new Error("Run is over");
    if (this.deck.length === 0) {
      // Fresh deck without the card on the table, so the odds stay honest.
      this.deck = shuffle(this.nextPool(), this.rng);
    }
    const card = this.take();
    const diff = rankValue(card.rank) - rankValue(this.current.rank);
    let result: CallResult;
    if (diff === 0) result = "tie";
    else if ((diff > 0) === (guess === "higher")) result = "right";
    else result = "wrong";

    if (result === "right") this.streak++;
    if (result === "wrong") this.over = true;
    this.current = card;
    this.history.push(card);
    return { card, result };
  }
}
