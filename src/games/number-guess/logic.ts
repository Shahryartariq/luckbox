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

/** Tries a perfect binary search needs in the worst case. Shown as the target to beat. */
export function perfectTries(max: number): number {
  return Math.ceil(Math.log2(max + 1));
}
