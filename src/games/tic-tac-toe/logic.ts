import { type Rng, cryptoRng } from "../../shared/rng";

export type Mark = "X" | "O";
export type Cell = Mark | null;
export type Board = Cell[];
export type Level = "easy" | "medium" | "hard" | "duo";

export const LEVELS: Record<Level, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Unbeatable",
  duo: "Two players",
};

export const LINES: readonly (readonly [number, number, number])[] = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

export const other = (m: Mark): Mark => (m === "X" ? "O" : "X");

export function emptyBoard(): Board {
  return Array<Cell>(9).fill(null);
}

export function winner(board: Board): { mark: Mark; line: readonly number[] } | null {
  for (const line of LINES) {
    const [a, b, c] = line;
    const m = board[a];
    if (m && m === board[b] && m === board[c]) return { mark: m, line };
  }
  return null;
}

export const isFull = (board: Board): boolean => board.every((c) => c !== null);
export const openCells = (board: Board): number[] => board.flatMap((c, i) => (c === null ? [i] : []));

/** Minimax score from `me`'s point of view: faster wins and slower losses score higher. */
function score(board: Board, me: Mark, toMove: Mark, depth: number): number {
  const w = winner(board);
  if (w) return w.mark === me ? 10 - depth : depth - 10;
  if (isFull(board)) return 0;
  let best = toMove === me ? -Infinity : Infinity;
  for (const i of openCells(board)) {
    board[i] = toMove;
    const s = score(board, me, other(toMove), depth + 1);
    board[i] = null;
    best = toMove === me ? Math.max(best, s) : Math.min(best, s);
  }
  return best;
}

/** Every move that is as good as possible for `me`. */
export function bestMoves(board: Board, me: Mark): number[] {
  const b = [...board];
  let best = -Infinity;
  let moves: number[] = [];
  for (const i of openCells(b)) {
    b[i] = me;
    const s = score(b, me, other(me), 1);
    b[i] = null;
    if (s > best) {
      best = s;
      moves = [i];
    } else if (s === best) {
      moves.push(i);
    }
  }
  return moves;
}

/** A move that completes a line for `mark`, if there is one. */
export function finishingMove(board: Board, mark: Mark): number | null {
  for (const [a, b, c] of LINES) {
    const cells = [a, b, c];
    const mine = cells.filter((i) => board[i] === mark).length;
    const empty = cells.filter((i) => board[i] === null);
    if (mine === 2 && empty.length === 1) return empty[0] ?? null;
  }
  return null;
}

const pick = (cells: number[], rng: Rng): number => cells[Math.floor(rng() * cells.length)] ?? cells[0] ?? -1;

/**
 * The computer's move.
 * Easy plays at random. Medium takes a win, blocks yours, and otherwise plays
 * well most of the time but not always. Hard plays perfectly and never loses.
 */
export function cpuMove(board: Board, me: Mark, level: Exclude<Level, "duo">, rng: Rng = cryptoRng): number {
  const open = openCells(board);
  if (open.length === 0) throw new Error("Board is full");
  if (level === "easy") return pick(open, rng);
  if (level === "medium") {
    const win = finishingMove(board, me);
    if (win !== null) return win;
    const block = finishingMove(board, other(me));
    if (block !== null) return block;
    return rng() < 0.6 ? pick(bestMoves(board, me), rng) : pick(open, rng);
  }
  return pick(bestMoves(board, me), rng);
}

export type Status = "playing" | "won" | "draw";

export interface SavedTicTacToe {
  board: Board;
  turn: Mark;
  level: Level;
  /** Who moved first this game (the starter alternates between games). */
  starter: Mark;
}

/** One game. You are always X; against the computer it plays O. */
export class TicTacToe {
  board: Board = emptyBoard();
  turn: Mark;

  constructor(
    public level: Level,
    public starter: Mark = "X",
  ) {
    this.turn = starter;
  }

  get result(): { status: Status; mark?: Mark; line?: readonly number[] } {
    const w = winner(this.board);
    if (w) return { status: "won", mark: w.mark, line: w.line };
    if (isFull(this.board)) return { status: "draw" };
    return { status: "playing" };
  }

  get over(): boolean {
    return this.result.status !== "playing";
  }

  get vsCpu(): boolean {
    return this.level !== "duo";
  }

  canPlay(i: number): boolean {
    return !this.over && Number.isInteger(i) && i >= 0 && i < 9 && this.board[i] === null;
  }

  play(i: number): void {
    if (!this.canPlay(i)) throw new Error("Can't play there");
    this.board[i] = this.turn;
    this.turn = other(this.turn);
  }

  /** Plays the computer's move (O). */
  cpuTurn(rng: Rng = cryptoRng): number {
    if (!this.vsCpu || this.turn !== "O" || this.over) throw new Error("Not the computer's turn");
    const i = cpuMove(this.board, "O", this.level as Exclude<Level, "duo">, rng);
    this.play(i);
    return i;
  }

  save(): SavedTicTacToe {
    return { board: [...this.board], turn: this.turn, level: this.level, starter: this.starter };
  }

  static restore(data: unknown): TicTacToe | null {
    const d = data as Partial<SavedTicTacToe> | null;
    if (!d || !Array.isArray(d.board) || d.board.length !== 9) return null;
    if (!d.board.every((c) => c === null || c === "X" || c === "O")) return null;
    if (!(d.level && d.level in LEVELS) || (d.turn !== "X" && d.turn !== "O") || (d.starter !== "X" && d.starter !== "O")) return null;
    // Counts must match whose turn it is.
    const xs = d.board.filter((c) => c === "X").length;
    const os = d.board.filter((c) => c === "O").length;
    const moved = d.starter === "X" ? xs - os : os - xs;
    if (moved !== 0 && moved !== 1) return null;
    if ((moved === 0 ? d.starter : other(d.starter)) !== d.turn) return null;
    const game = new TicTacToe(d.level, d.starter);
    game.board = d.board as Board;
    game.turn = d.turn;
    return game;
  }
}
