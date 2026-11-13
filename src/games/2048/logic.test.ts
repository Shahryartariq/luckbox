import { describe, expect, it } from "vitest";
import { seededRng } from "../../shared/rng";
import { type Direction, Game2048, type Tile, canMove, move } from "./logic";

/** Builds tiles from a 4x4 grid of numbers (0 = empty). */
function grid(rows: number[][]): Tile[] {
  const out: Tile[] = [];
  let id = 1;
  rows.forEach((r, row) => r.forEach((value, col) => value && out.push({ id: id++, value, row, col })));
  return out;
}

function toGrid(tiles: Tile[]): number[][] {
  const g = Array.from({ length: 4 }, () => Array(4).fill(0));
  for (const t of tiles) g[t.row]![t.col] = t.value;
  return g;
}

describe("move", () => {
  it("slides and merges toward the wall, once per tile", () => {
    const tiles = grid([
      [2, 2, 2, 0],
      [2, 2, 2, 2],
      [4, 0, 4, 8],
      [0, 0, 0, 2],
    ]);
    const r = move(tiles, "left");
    expect(toGrid(r.tiles)).toEqual([
      [4, 2, 0, 0],
      [4, 4, 0, 0],
      [8, 8, 0, 0],
      [2, 0, 0, 0],
    ]);
    expect(r.gained).toBe(4 + 4 + 4 + 8);
    expect(r.merged).toHaveLength(4);
    expect(r.absorbed).toHaveLength(4);
    expect(r.moved).toBe(true);
  });

  it("works in every direction", () => {
    const tiles = grid([
      [2, 0, 0, 2],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [2, 0, 0, 4],
    ]);
    const expected: Record<Direction, number[][]> = {
      left: [[4, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [2, 4, 0, 0]],
      right: [[0, 0, 0, 4], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 2, 4]],
      up: [[4, 0, 0, 2], [0, 0, 0, 4], [0, 0, 0, 0], [0, 0, 0, 0]],
      down: [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 2], [4, 0, 0, 4]],
    };
    for (const dir of Object.keys(expected) as Direction[]) {
      expect(toGrid(move(tiles, dir).tiles)).toEqual(expected[dir]);
    }
  });

  it("reports no move when nothing can slide", () => {
    const tiles = grid([
      [2, 4, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    expect(move(tiles, "left").moved).toBe(false);
    expect(move(tiles, "up").moved).toBe(false);
    expect(move(tiles, "right").moved).toBe(true);
  });

  it("does not mutate the input", () => {
    const tiles = grid([[2, 2, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
    const copy = JSON.stringify(tiles);
    move(tiles, "left");
    expect(JSON.stringify(tiles)).toBe(copy);
  });
});

describe("canMove", () => {
  it("is false only on a full board with no equal neighbours", () => {
    expect(canMove(grid([[2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 4, 2]]))).toBe(false);
    expect(canMove(grid([[2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 4, 4]]))).toBe(true);
    expect(canMove(grid([[2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 4, 0]]))).toBe(true);
  });
});

describe("Game2048", () => {
  it("starts with two tiles and spawns one per move", () => {
    const g = new Game2048(seededRng(1));
    expect(g.tiles).toHaveLength(2);
    const dirs: Direction[] = ["left", "up", "right", "down"];
    let moves = 0;
    for (let i = 0; i < 2000 && !g.over; i++) {
      const before = g.tiles.length;
      const r = g.play(dirs[i % 4]!);
      if (!r) continue;
      moves++;
      expect(g.tiles.length).toBe(before - r.absorbed.length + 1);
      expect(g.tiles.every((t) => t.value >= 2)).toBe(true);
    }
    expect(moves).toBeGreaterThan(20);
    expect(g.over).toBe(true);
    expect(g.play("left")).toBeNull();
  });

  it("score equals the sum of merged values", () => {
    const g = new Game2048(seededRng(7));
    let total = 0;
    for (let i = 0; i < 300 && !g.over; i++) {
      const r = g.play((["left", "down", "right", "up"] as Direction[])[i % 4]!);
      if (r) total += r.gained;
    }
    expect(g.score).toBe(total);
  });

  it("flags 2048 once and lets you keep playing", () => {
    const g = new Game2048(seededRng(3));
    g.tiles = grid([[1024, 1024, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
    const r = g.play("left");
    expect(r?.reachedWin).toBe(true);
    expect(g.won).toBe(true);
    expect(g.over).toBe(false);
  });

  it("restores saved games and rejects bad ones", () => {
    const g = new Game2048(seededRng(4));
    expect(g.restore({ tiles: [{ value: 8, row: 1, col: 2 }], score: 40, won: false })).toBe(true);
    expect(g.tiles).toHaveLength(1);
    expect(g.score).toBe(40);
    expect(g.restore({ tiles: [{ value: 3, row: 0, col: 0 }], score: 0, won: false })).toBe(false);
    expect(g.restore({ tiles: [{ value: 2, row: 4, col: 0 }], score: 0, won: false })).toBe(false);
    expect(g.restore({ tiles: [{ value: 2, row: 0, col: 0 }, { value: 2, row: 0, col: 0 }], score: 0, won: false })).toBe(false);
    expect(g.restore({ tiles: "x", score: 0, won: false })).toBe(false);
  });
});
