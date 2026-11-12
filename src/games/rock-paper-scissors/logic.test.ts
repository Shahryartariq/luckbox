import { describe, expect, it } from "vitest";
import { seededRng } from "../../shared/rng";
import { MOVES, judge, matchWinner, newMatch, playRound, randomMove } from "./logic";

describe("judge", () => {
  it("covers every pairing", () => {
    expect(judge("rock", "scissors")).toBe("win");
    expect(judge("paper", "rock")).toBe("win");
    expect(judge("scissors", "paper")).toBe("win");
    expect(judge("scissors", "rock")).toBe("lose");
    expect(judge("rock", "paper")).toBe("lose");
    expect(judge("paper", "scissors")).toBe("lose");
    for (const m of MOVES) expect(judge(m, m)).toBe("draw");
  });
});

describe("match", () => {
  it("ends when one side reaches the target, draws don't score", () => {
    let m = newMatch(3);
    m = playRound(m, "rock", "rock").match;
    expect(m).toMatchObject({ you: 0, cpu: 0, rounds: 1 });
    m = playRound(m, "rock", "scissors").match;
    m = playRound(m, "rock", "paper").match;
    m = playRound(m, "paper", "rock").match;
    expect(matchWinner(m)).toBeNull();
    m = playRound(m, "scissors", "paper").match;
    expect(matchWinner(m)).toBe("you");
    expect(() => playRound(m, "rock", "rock")).toThrow();
  });

  it("random moves cover all three options", () => {
    const rng = seededRng(7);
    const seen = new Set(Array.from({ length: 60 }, () => randomMove(rng)));
    expect(seen.size).toBe(3);
  });
});
