import { describe, expect, it } from "vitest";
import { seededRng } from "../../shared/rng";
import { type Board, type Cell, type Mark, TicTacToe, bestMoves, cpuMove, emptyBoard, finishingMove, openCells, other, winner } from "./logic";

const b = (s: string): Board => [...s].map((c): Cell => (c === "X" || c === "O" ? c : null));

describe("rules", () => {
  it("finds every winning line", () => {
    expect(winner(b("XXX......"))?.line).toEqual([0, 1, 2]);
    expect(winner(b("O..O..O.."))?.mark).toBe("O");
    expect(winner(b("X...X...X"))?.line).toEqual([0, 4, 8]);
    expect(winner(b("..O.O.O.."))?.line).toEqual([2, 4, 6]);
    expect(winner(b("XOXXOOOXX"))).toBeNull();
  });

  it("finds a finishing move", () => {
    expect(finishingMove(b("XX.......") , "X")).toBe(2);
    expect(finishingMove(b("XX.......") , "O")).toBeNull();
  });
});

describe("computer", () => {
  it("hard takes a win and blocks a loss", () => {
    expect(bestMoves(b("OO.XX...."), "O")).toEqual([2]);
    expect(bestMoves(b("XX..O...."), "O")).toEqual([2]);
  });

  /** Plays every possible game where you move anywhere and the computer answers. */
  function worstCase(level: "hard" | "medium", starter: Mark): { losses: number; games: number } {
    let losses = 0;
    let games = 0;
    const rng = seededRng(1);
    const explore = (board: Board, turn: Mark): void => {
      const w = winner(board);
      if (w || openCells(board).length === 0) {
        games++;
        if (w?.mark === "X") losses++;
        return;
      }
      if (turn === "X") {
        for (const i of openCells(board)) {
          const next = [...board];
          next[i] = "X";
          explore(next, "O");
        }
      } else {
        const next = [...board];
        next[cpuMove(board, "O", level, rng)] = "O";
        explore(next, "X");
      }
    };
    explore(emptyBoard(), starter);
    return { losses, games };
  }

  it("hard never loses, whoever starts", () => {
    for (const starter of ["X", "O"] as const) {
      const { losses, games } = worstCase("hard", starter);
      expect(games).toBeGreaterThan(50);
      expect(losses).toBe(0);
    }
  });

  it("medium can be beaten, easy plays only legal moves", () => {
    expect(worstCase("medium", "X").losses).toBeGreaterThan(0);
    const rng = seededRng(3);
    for (let t = 0; t < 200; t++) {
      const board = b("XO.X.O..X");
      const i = cpuMove(board, "O", "easy", rng);
      expect(board[i]).toBeNull();
    }
  });
});

describe("TicTacToe", () => {
  it("plays a full game and reports the winner", () => {
    const g = new TicTacToe("duo");
    for (const i of [0, 3, 1, 4, 2]) g.play(i);
    expect(g.result).toMatchObject({ status: "won", mark: "X", line: [0, 1, 2] });
    expect(g.canPlay(5)).toBe(false);
    expect(() => g.play(5)).toThrow();
  });

  it("reports a draw", () => {
    const g = new TicTacToe("duo");
    for (const i of [0, 1, 2, 4, 3, 5, 7, 6, 8]) g.play(i);
    expect(g.result.status).toBe("draw");
  });

  it("the computer moves as O when it starts", () => {
    const g = new TicTacToe("hard", "O");
    g.cpuTurn(seededRng(2));
    expect(g.board.filter(Boolean)).toEqual(["O"]);
    expect(g.turn).toBe("X");
    expect(() => g.cpuTurn()).toThrow();
  });

  it("saves and restores, rejecting impossible boards", () => {
    const g = new TicTacToe("medium", "X");
    g.play(4);
    const back = TicTacToe.restore(JSON.parse(JSON.stringify(g.save())))!;
    expect(back.board).toEqual(g.board);
    expect(back.turn).toBe("O");
    expect(TicTacToe.restore({ board: b("XX......."), turn: "O", level: "easy", starter: "X" })).toBeNull();
    expect(TicTacToe.restore({ board: b("X........"), turn: "X", level: "easy", starter: "X" })).toBeNull();
    expect(TicTacToe.restore({ board: b("X........"), turn: "O", level: "silly", starter: "X" })).toBeNull();
    expect(TicTacToe.restore(null)).toBeNull();
    expect(other("X")).toBe("O");
  });
});
