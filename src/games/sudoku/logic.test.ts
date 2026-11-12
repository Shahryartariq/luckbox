import { describe, expect, it } from "vitest";
import { seededRng } from "../../shared/rng";
import { LEVELS, type Level, PEERS, boxOf, conflicts, countSolutions, formatTime, generate, isSolved, solve } from "./logic";

const isValidSolution = (b: number[]): boolean =>
  b.every((v, i) => v >= 1 && v <= 9 && PEERS[i]!.every((p) => b[p] !== v));

describe("sudoku helpers", () => {
  it("every cell has 20 peers", () => {
    expect(PEERS.every((p) => p.length === 20)).toBe(true);
    expect(boxOf(0)).toBe(0);
    expect(boxOf(80)).toBe(8);
    expect(boxOf(40)).toBe(4);
  });

  it("finds conflicts", () => {
    const b = Array(81).fill(0);
    b[0] = 5;
    b[8] = 5;
    b[40] = 5;
    expect([...conflicts(b)].sort((x, y) => x - y)).toEqual([0, 8]);
  });

  it("formats time", () => {
    expect(formatTime(0)).toBe("0:00");
    expect(formatTime(75)).toBe("1:15");
    expect(formatTime(3600)).toBe("60:00");
  });
});

describe("generate", () => {
  for (const level of Object.keys(LEVELS) as Level[]) {
    it(`${level} puzzles have one solution and the right number of clues`, () => {
      for (let seed = 0; seed < 4; seed++) {
        const { puzzle, solution } = generate(level, seededRng(seed * 31 + level.length));
        expect(isValidSolution(solution)).toBe(true);
        expect(puzzle.every((v, i) => v === 0 || v === solution[i])).toBe(true);
        expect(countSolutions(puzzle)).toBe(1);
        const clues = puzzle.filter(Boolean).length;
        expect(clues).toBeGreaterThanOrEqual(LEVELS[level].clues - 1);
        expect(clues).toBeLessThanOrEqual(LEVELS[level].clues + 6);
        expect(solve(puzzle)).toEqual(solution);
      }
    });
  }

  it("is symmetric", () => {
    const { puzzle } = generate("medium", seededRng(99));
    for (let i = 0; i < 81; i++) expect(puzzle[i] === 0).toBe(puzzle[80 - i] === 0);
  });

  it("isSolved compares with the solution", () => {
    const { puzzle, solution } = generate("easy", seededRng(5));
    expect(isSolved(puzzle, solution)).toBe(false);
    expect(isSolved([...solution], solution)).toBe(true);
  });
});
