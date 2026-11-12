import { describe, expect, it } from "vitest";
import { seededRng } from "../../shared/rng";
import { TARGET, bank, cpuWantsToRoll, newGame, roll } from "./logic";

describe("Pig", () => {
  it("a 1 wipes the turn and passes it", () => {
    const one = () => 0; // randomInt(1, 6) -> 1
    let s = newGame();
    s = { ...s, turnTotal: 12 };
    s = roll(s, one);
    expect(s).toMatchObject({ turn: "cpu", turnTotal: 0, lastRoll: 1 });
  });

  it("other rolls add up, banking moves points and passes the turn", () => {
    const six = () => 0.99;
    let s = roll(roll(newGame(), six), six);
    expect(s.turnTotal).toBe(12);
    s = bank(s);
    expect(s.scores.you).toBe(12);
    expect(s.turn).toBe("cpu");
    expect(() => bank(s)).toThrow();
  });

  it("reaching the target wins", () => {
    let s = newGame();
    s = { ...s, scores: { you: TARGET - 4, cpu: 0 }, turnTotal: 4 };
    s = bank(s);
    expect(s.winner).toBe("you");
    expect(() => roll(s)).toThrow();
  });

  it("cpu banks a winning total and rolls when the turn is small", () => {
    const base = newGame("cpu");
    expect(cpuWantsToRoll({ ...base, scores: { you: 0, cpu: 45 }, turnTotal: 5 })).toBe(false);
    expect(cpuWantsToRoll({ ...base, turnTotal: 4 })).toBe(true);
    expect(cpuWantsToRoll({ ...base, turnTotal: 22 })).toBe(false);
    expect(cpuWantsToRoll({ ...base, scores: { you: 45, cpu: 10 }, turnTotal: 22 })).toBe(true);
  });

  it("full games always finish", () => {
    for (let seed = 0; seed < 100; seed++) {
      const rng = seededRng(seed);
      let s = newGame();
      let steps = 0;
      while (!s.winner && steps < 10_000) {
        const wantsRoll = s.turn === "cpu" ? cpuWantsToRoll(s) : s.turnTotal < 15;
        s = wantsRoll || s.turnTotal === 0 ? roll(s, rng) : bank(s);
        steps++;
      }
      expect(s.winner).not.toBeNull();
      expect(Math.max(s.scores.you, s.scores.cpu)).toBeGreaterThanOrEqual(TARGET);
    }
  });
});
