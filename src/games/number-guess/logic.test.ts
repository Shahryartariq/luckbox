import { describe, expect, it } from "vitest";
import { seededRng } from "../../shared/rng";
import { LEVELS, NumberGuess, parseGuess, perfectTries, restoreGame, saveGame } from "./logic";

describe("NumberGuess", () => {
  it("can pick every number in range, including the top one", () => {
    const rng = seededRng(5);
    const seen = new Set(Array.from({ length: 2000 }, () => new NumberGuess("easy", rng).secret));
    expect(Math.min(...seen)).toBe(1);
    expect(Math.max(...seen)).toBe(20);
    expect(seen.size).toBe(20);
  });

  it("narrows the range and wins with binary search", () => {
    for (let seed = 0; seed < 200; seed++) {
      const game = new NumberGuess("hard", seededRng(seed));
      while (game.status === "playing") {
        const mid = Math.floor((game.low + game.high) / 2);
        game.guess(mid);
        expect(game.low).toBeLessThanOrEqual(game.secret);
        expect(game.high).toBeGreaterThanOrEqual(game.secret);
      }
      expect(game.status).toBe("won");
      expect(game.guesses.length).toBeLessThanOrEqual(perfectTries(LEVELS.hard.max));
    }
  });

  it("rejects bad and repeated guesses without using a try", () => {
    const game = new NumberGuess("normal", seededRng(1));
    expect(game.validate(0)).toMatch(/1 to 100/);
    expect(game.validate(101)).toMatch(/1 to 100/);
    expect(game.validate(2.5)).toMatch(/whole number/);
    const first = game.secret === 50 ? 51 : 50;
    game.guess(first);
    expect(game.validate(first)).toMatch(/already tried/);
    expect(game.triesLeft).toBe(6);
  });

  it("loses after the last try", () => {
    const game = new NumberGuess("easy", seededRng(2));
    const wrong = Array.from({ length: 20 }, (_, i) => i + 1).filter((n) => n !== game.secret);
    for (let i = 0; i < 5; i++) game.guess(wrong[i]!);
    expect(game.status).toBe("lost");
    expect(game.validate(game.secret)).toMatch(/over/);
  });

  it("perfect tries", () => {
    expect(perfectTries(20)).toBe(5);
    expect(perfectTries(100)).toBe(7);
    expect(perfectTries(1000)).toBe(10);
  });
});

describe("saving and input", () => {
  it("restores a game in progress by replaying guesses", () => {
    const game = new NumberGuess("normal", seededRng(11));
    const first = game.secret === 50 ? 49 : 50;
    game.guess(first);
    const back = restoreGame(JSON.parse(JSON.stringify(saveGame(game))))!;
    expect(back.secret).toBe(game.secret);
    expect(back.triesLeft).toBe(6);
    expect([back.low, back.high]).toEqual([game.low, game.high]);
    expect(restoreGame({ level: "normal", secret: 500, guesses: [] })).toBeNull();
    expect(restoreGame({ level: "silly", secret: 5, guesses: [] })).toBeNull();
    expect(restoreGame({ level: "easy", secret: 5, guesses: [3, 3] })).toBeNull();
  });

  it("restores every possible secret exactly", () => {
    for (let s = 1; s <= 1000; s++) expect(restoreGame({ level: "hard", secret: s, guesses: [] })?.secret).toBe(s);
  });

  it("only accepts plain whole numbers", () => {
    expect(parseGuess(" 42 ")).toBe(42);
    expect(parseGuess("1e1")).toBeNaN();
    expect(parseGuess("10.0")).toBeNaN();
    expect(parseGuess("-3")).toBeNaN();
    expect(parseGuess("")).toBeNaN();
  });
});
