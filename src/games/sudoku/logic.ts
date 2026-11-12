import { type Rng, cryptoRng, shuffle } from "../../shared/rng";

/** A board is 81 numbers, row by row. 0 means empty. */
export type Board = number[];

export const LEVELS = {
  easy: { clues: 40, label: "Easy" },
  medium: { clues: 32, label: "Medium" },
  hard: { clues: 26, label: "Hard" },
} as const;
export type Level = keyof typeof LEVELS;

export const rowOf = (i: number): number => Math.floor(i / 9);
export const colOf = (i: number): number => i % 9;
export const boxOf = (i: number): number => Math.floor(rowOf(i) / 3) * 3 + Math.floor(colOf(i) / 3);

/** For each cell, the 20 other cells in its row, column and box. */
export const PEERS: readonly (readonly number[])[] = Array.from({ length: 81 }, (_, i) => {
  const out: number[] = [];
  for (let j = 0; j < 81; j++) {
    if (j !== i && (rowOf(j) === rowOf(i) || colOf(j) === colOf(i) || boxOf(j) === boxOf(i))) out.push(j);
  }
  return out;
});

export function peersOf(i: number): readonly number[] {
  return PEERS[i] ?? [];
}

export function canPlace(board: Board, i: number, n: number): boolean {
  return peersOf(i).every((p) => board[p] !== n);
}

/** Fills the board in place by backtracking. Tries candidates in random order when an rng is given. */
function fill(board: Board, rng?: Rng): boolean {
  // Pick the empty cell with the fewest options; this keeps search fast.
  let best = -1;
  let bestOptions: number[] = [];
  for (let i = 0; i < 81; i++) {
    if (board[i] !== 0) continue;
    const options: number[] = [];
    for (let n = 1; n <= 9; n++) if (canPlace(board, i, n)) options.push(n);
    if (options.length === 0) return false;
    if (best === -1 || options.length < bestOptions.length) {
      best = i;
      bestOptions = options;
      if (options.length === 1) break;
    }
  }
  if (best === -1) return true;
  for (const n of rng ? shuffle(bestOptions, rng) : bestOptions) {
    board[best] = n;
    if (fill(board, rng)) return true;
  }
  board[best] = 0;
  return false;
}

/** Counts solutions, stopping once `limit` is reached. */
export function countSolutions(board: Board, limit = 2): number {
  const b = [...board];
  let count = 0;
  const search = (): void => {
    if (count >= limit) return;
    let best = -1;
    let bestOptions: number[] = [];
    for (let i = 0; i < 81; i++) {
      if (b[i] !== 0) continue;
      const options: number[] = [];
      for (let n = 1; n <= 9; n++) if (canPlace(b, i, n)) options.push(n);
      if (options.length === 0) return;
      if (best === -1 || options.length < bestOptions.length) {
        best = i;
        bestOptions = options;
        if (options.length === 1) break;
      }
    }
    if (best === -1) {
      count++;
      return;
    }
    for (const n of bestOptions) {
      b[best] = n;
      search();
      if (count >= limit) break;
    }
    b[best] = 0;
  };
  search();
  return count;
}

export function solve(board: Board): Board | null {
  const b = [...board];
  return fill(b) ? b : null;
}

export interface Puzzle {
  puzzle: Board;
  solution: Board;
  level: Level;
}

/** Makes a puzzle with exactly one solution, removing clues in symmetric pairs. */
export function generate(level: Level, rng: Rng = cryptoRng): Puzzle {
  const solution: Board = Array(81).fill(0);
  fill(solution, rng);
  const puzzle = [...solution];
  const target = LEVELS[level].clues;
  let clues = 81;
  for (const i of shuffle([...Array(41).keys()], rng)) {
    if (clues <= target) break;
    const j = 80 - i;
    const pair = i === j ? [i] : [i, j];
    if (clues - pair.length < target - 1) continue;
    const saved = pair.map((k) => puzzle[k] ?? 0);
    pair.forEach((k) => (puzzle[k] = 0));
    if (countSolutions(puzzle) === 1) clues -= pair.length;
    else pair.forEach((k, n) => (puzzle[k] = saved[n] ?? 0));
  }
  return { puzzle, solution, level };
}

/** Cells whose value repeats in their row, column or box. */
export function conflicts(board: Board): Set<number> {
  const out = new Set<number>();
  for (let i = 0; i < 81; i++) {
    const v = board[i];
    if (!v) continue;
    for (const p of peersOf(i)) {
      if (board[p] === v) {
        out.add(i);
        out.add(p);
      }
    }
  }
  return out;
}

export function isSolved(board: Board, solution: Board): boolean {
  return board.every((v, i) => v === solution[i]);
}

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
