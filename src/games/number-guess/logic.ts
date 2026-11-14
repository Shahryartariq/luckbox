import { type Rng, cryptoRng, randomInt } from "../../shared/rng";

export const LEVELS = {
  easy: { max: 20, tries: 5, label: "Easy" },
  normal: { max: 100, tries: 7, label: "Normal" },
  hard: { max: 1000, tries: 10, label: "Hard" },
} as const;

export type Level = keyof typeof LEVELS;
export type GuessResult = "higher" | "lower" | "correct";

export interface GuessEntry {
  value: number;
  result: GuessResult;
}

export class NumberGuess {
  readonly max: number;
  readonly tries: number;
  readonly secret: number;
  /** Smallest and largest numbers the secret can still be. */
  low = 1;
  high: number;
  guesses: GuessEntry[] = [];
  status: "playing" | "won" | "lost" = "playing";

  constructor(
    readonly level: Level,
    rng: Rng = cryptoRng,
  ) {
    this.max = LEVELS[level].max;
    this.tries = LEVELS[level].tries;
    this.high = this.max;
    this.secret = randomInt(1, this.max, rng);
  }

  get triesLeft(): number {
    return this.tries - this.guesses.length;
  }

  /** Returns an error message for bad input, or null if the guess is allowed. */
  validate(value: number): string | null {
    if (this.status !== "playing") return "This round is over. Start a new one.";
    if (!Number.isInteger(value)) return `Enter a whole number from 1 to ${this.max}.`;
    if (value < 1 || value > this.max) return `Pick a number from 1 to ${this.max}.`;
    if (this.guesses.some((g) => g.value === value)) return `You already tried ${value}.`;
    return null;
  }

  guess(value: number): GuessResult {
    const error = this.validate(value);
    if (error) throw new Error(error);
    const result: GuessResult = value === this.secret ? "correct" : value < this.secret ? "higher" : "lower";
    this.guesses.push({ value, result });
    if (result === "higher") this.low = Math.max(this.low, value + 1);
    if (result === "lower") this.high = Math.min(this.high, value - 1);
    if (result === "correct") {
      this.status = "won";
      this.low = this.high = value;
    } else if (this.triesLeft === 0) {
      this.status = "lost";
    }
    return result;
  }
}

export interface SavedGuessGame {
  level: string;
  secret: number;
  guesses: number[];
}

/** Rebuilds a saved game by replaying its guesses. Returns null for data that isn't a valid game. */
export function restoreGame(data: unknown): NumberGuess | null {
  const d = data as Partial<SavedGuessGame> | null;
  if (!d || typeof d.level !== "string" || !(d.level in LEVELS) || !Array.isArray(d.guesses)) return null;
  const level = d.level as Level;
  const max = LEVELS[level].max;
  if (!Number.isInteger(d.secret) || (d.secret as number) < 1 || (d.secret as number) > max) return null;
  const secret = d.secret as number;
  // An rng that makes randomInt(1, max) return exactly `secret`.
  const game = new NumberGuess(level, () => (secret - 1 + 0.5) / max);
  for (const g of d.guesses) {
    if (typeof g !== "number" || game.validate(g)) return null;
    game.guess(g);
  }
  return game;
}

export function saveGame(game: NumberGuess): SavedGuessGame {
  return { level: game.level, secret: game.secret, guesses: game.guesses.map((g) => g.value) };
}

/** Parses what the player typed: digits only, so "1e1" or "10.0" are rejected rather than read as 10. */
export function parseGuess(raw: string): number {
  const t = raw.trim();
  return /^\d{1,7}$/.test(t) ? Number(t) : NaN;
}

/** Tries a perfect binary search needs in the worst case. Shown as the target to beat. */
export function perfectTries(max: number): number {
  return Math.ceil(Math.log2(max + 1));
}
