import { type Card, type Rank, shuffledDeck } from "../../shared/cards";
import { type Rng, cryptoRng } from "../../shared/rng";

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

  get odds(): Odds {
    return odds(this.current, this.deck);
  }

  /** Makes a call, flips the next card and returns what happened. A tie keeps the run going. */
  call(guess: Call): { card: Card; result: CallResult } {
    if (this.over) throw new Error("Run is over");
    if (this.deck.length === 0) {
      // Fresh deck without the card on the table, so the odds stay honest.
      this.deck = shuffledDeck(1, this.rng).filter(
        (c) => !(c.rank === this.current.rank && c.suit === this.current.suit),
      );
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
