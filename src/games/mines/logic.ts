import { type Rng, cryptoRng, shuffle } from "../../shared/rng";

export const SIZE = 25;
export const MINE_OPTIONS = [3, 5, 10] as const;
export const STAKE = 10;
export const STARTING_POINTS = 100;

/** Fair multiplier after `safe` safe picks with `mines` mines on the board. */
export function multiplier(mines: number, safe: number): number {
  let m = 1;
  for (let i = 0; i < safe; i++) m *= (SIZE - i) / (SIZE - mines - i);
  return m;
}

/** Chance the next tile is safe. */
export function safeChance(mines: number, safe: number): number {
  return (SIZE - mines - safe) / (SIZE - safe);
}

export function roundMultiplier(m: number): number {
  return Math.floor(m * 100) / 100;
}

export type RoundStatus = "playing" | "busted" | "cashed";

export class MinesRound {
  readonly mineAt: ReadonlySet<number>;
  revealed = new Set<number>();
  status: RoundStatus = "playing";
  hit: number | null = null;

  constructor(
    readonly mines: number,
    readonly stake: number = STAKE,
    rng: Rng = cryptoRng,
  ) {
    if (mines < 1 || mines >= SIZE) throw new Error("Bad mine count");
    const tiles = shuffle(
      Array.from({ length: SIZE }, (_, i) => i),
      rng,
    );
    this.mineAt = new Set(tiles.slice(0, mines));
  }

  get safeCount(): number {
    return this.revealed.size;
  }

  get multiplier(): number {
    return roundMultiplier(multiplier(this.mines, this.safeCount));
  }

  get nextMultiplier(): number {
    return roundMultiplier(multiplier(this.mines, this.safeCount + 1));
  }

  /** Points paid if you cash out now. */
  get payout(): number {
    return Math.floor(this.stake * this.multiplier);
  }

  get cleared(): boolean {
    return this.safeCount === SIZE - this.mines;
  }

  reveal(tile: number): "safe" | "mine" {
    if (this.status !== "playing") throw new Error("Round is over");
    if (tile < 0 || tile >= SIZE || this.revealed.has(tile)) throw new Error("Bad tile");
    if (this.mineAt.has(tile)) {
      this.status = "busted";
      this.hit = tile;
      return "mine";
    }
    this.revealed.add(tile);
    if (this.cleared) this.status = "cashed";
    return "safe";
  }

  save(): { mines: number; stake: number; mineAt: number[]; revealed: number[]; status: RoundStatus; hit: number | null } {
    return { mines: this.mines, stake: this.stake, mineAt: [...this.mineAt], revealed: [...this.revealed], status: this.status, hit: this.hit };
  }

  /** Rebuilds a round from saved data, or returns null if the data isn't a valid round. */
  static restore(data: unknown): MinesRound | null {
    const d = data as Partial<ReturnType<MinesRound["save"]>> | null;
    if (!d || typeof d !== "object") return null;
    const tiles = (x: unknown): x is number[] =>
      Array.isArray(x) && x.every((n) => Number.isInteger(n) && n >= 0 && n < SIZE) && new Set(x).size === x.length;
    if (typeof d.mines !== "number" || typeof d.stake !== "number" || !tiles(d.mineAt) || !tiles(d.revealed)) return null;
    if (d.mineAt.length !== d.mines || d.revealed.some((t) => d.mineAt?.includes(t))) return null;
    if (d.status !== "playing" && d.status !== "busted" && d.status !== "cashed") return null;
    const round = new MinesRound(d.mines, d.stake);
    (round as { mineAt: ReadonlySet<number> }).mineAt = new Set(d.mineAt);
    round.revealed = new Set(d.revealed);
    round.status = d.status;
    round.hit = typeof d.hit === "number" ? d.hit : null;
    return round;
  }

  cashOut(): number {
    if (this.status !== "playing" || this.safeCount === 0) throw new Error("Can't cash out now");
    this.status = "cashed";
    return this.payout;
  }
}
