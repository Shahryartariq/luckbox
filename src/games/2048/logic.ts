import { type Rng, cryptoRng } from "../../shared/rng";

export const SIZE = 4;
export const WIN_VALUE = 2048;
export type Direction = "up" | "down" | "left" | "right";

export interface Tile {
  id: number;
  value: number;
  row: number;
  col: number;
}

/** A tile that merged into another on this move. The UI slides it to (row, col), then removes it. */
export interface Absorbed {
  id: number;
  row: number;
  col: number;
  into: number;
}

export interface MoveResult {
  tiles: Tile[];
  absorbed: Absorbed[];
  /** Ids of tiles whose value doubled this move. */
  merged: number[];
  gained: number;
  moved: boolean;
}

/**
 * Slides every tile in a direction. Each tile merges at most once per move,
 * and the tile nearer the wall wins: [2, 2, 2, _] moving left gives [4, 2, _, _].
 */
export function move(tiles: readonly Tile[], dir: Direction): MoveResult {
  const horizontal = dir === "left" || dir === "right";
  const towardStart = dir === "left" || dir === "up";
  const out: Tile[] = [];
  const absorbed: Absorbed[] = [];
  const merged: number[] = [];
  let gained = 0;
  let moved = false;

  for (let line = 0; line < SIZE; line++) {
    const inLine = tiles
      .filter((t) => (horizontal ? t.row === line : t.col === line))
      .sort((a, b) => {
        const pa = horizontal ? a.col : a.row;
        const pb = horizontal ? b.col : b.row;
        return towardStart ? pa - pb : pb - pa;
      });
    let slot = 0;
    let last: Tile | null = null;
    let lastMerged = false;
    for (const t of inLine) {
      if (last && !lastMerged && last.value === t.value) {
        last.value *= 2;
        gained += last.value;
        merged.push(last.id);
        absorbed.push({ id: t.id, row: last.row, col: last.col, into: last.id });
        lastMerged = true;
        moved = true;
        continue;
      }
      const pos = towardStart ? slot : SIZE - 1 - slot;
      const next: Tile = { ...t, row: horizontal ? line : pos, col: horizontal ? pos : line };
      if (next.row !== t.row || next.col !== t.col) moved = true;
      out.push(next);
      last = next;
      lastMerged = false;
      slot++;
    }
  }
  return { tiles: out, absorbed, merged, gained, moved };
}

export function emptyCells(tiles: readonly Tile[]): { row: number; col: number }[] {
  const taken = new Set(tiles.map((t) => t.row * SIZE + t.col));
  const out: { row: number; col: number }[] = [];
  for (let i = 0; i < SIZE * SIZE; i++) if (!taken.has(i)) out.push({ row: Math.floor(i / SIZE), col: i % SIZE });
  return out;
}

export function canMove(tiles: readonly Tile[]): boolean {
  if (tiles.length < SIZE * SIZE) return true;
  const at = new Map(tiles.map((t) => [t.row * SIZE + t.col, t.value]));
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const v = at.get(r * SIZE + c);
      if (c < SIZE - 1 && v === at.get(r * SIZE + c + 1)) return true;
      if (r < SIZE - 1 && v === at.get((r + 1) * SIZE + c)) return true;
    }
  }
  return false;
}

export class Game2048 {
  tiles: Tile[] = [];
  score = 0;
  /** True once 2048 has been reached; play can continue. */
  won = false;
  over = false;
  private nextId = 1;

  constructor(private readonly rng: Rng = cryptoRng) {
    this.spawn();
    this.spawn();
  }

  get best(): number {
    return this.tiles.reduce((m, t) => Math.max(m, t.value), 0);
  }

  /** Adds a 2 (90%) or a 4 (10%) in a random empty cell. */
  spawn(): Tile | null {
    const free = emptyCells(this.tiles);
    if (free.length === 0) return null;
    const cell = free[Math.floor(this.rng() * free.length)] ?? free[0];
    if (!cell) return null;
    const tile: Tile = { id: this.nextId++, value: this.rng() < 0.9 ? 2 : 4, ...cell };
    this.tiles.push(tile);
    return tile;
  }

  /** Plays a move. Returns null if nothing could slide that way. */
  play(dir: Direction): (MoveResult & { spawned: Tile | null; reachedWin: boolean }) | null {
    if (this.over) return null;
    const result = move(this.tiles, dir);
    if (!result.moved) return null;
    this.tiles = result.tiles;
    this.score += result.gained;
    const reachedWin = !this.won && this.best >= WIN_VALUE;
    if (reachedWin) this.won = true;
    const spawned = this.spawn();
    this.over = !canMove(this.tiles);
    return { ...result, spawned, reachedWin };
  }

  /** Restores a saved game. Returns false if the data doesn't describe a valid board. */
  restore(data: { tiles: unknown; score: unknown; won: unknown }): boolean {
    if (!Array.isArray(data.tiles) || typeof data.score !== "number" || typeof data.won !== "boolean") return false;
    const seen = new Set<number>();
    const tiles: Tile[] = [];
    for (const raw of data.tiles as unknown[]) {
      const t = raw as Partial<Tile>;
      const { value, row, col } = t;
      if (
        typeof value !== "number" || typeof row !== "number" || typeof col !== "number" ||
        value < 2 || (value & (value - 1)) !== 0 ||
        !Number.isInteger(row) || !Number.isInteger(col) || row < 0 || row >= SIZE || col < 0 || col >= SIZE ||
        seen.has(row * SIZE + col)
      ) {
        return false;
      }
      seen.add(row * SIZE + col);
      tiles.push({ id: this.nextId++, value, row, col });
    }
    if (tiles.length === 0) return false;
    this.tiles = tiles;
    this.score = Math.max(0, Math.floor(data.score));
    this.won = data.won;
    this.over = !canMove(tiles);
    return true;
  }
}
