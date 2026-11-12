import { type Rng, cryptoRng } from "../../shared/rng";

export const MOVES = ["rock", "paper", "scissors"] as const;
export type Move = (typeof MOVES)[number];
export type RoundResult = "win" | "lose" | "draw";

const BEATS: Record<Move, Move> = { rock: "scissors", paper: "rock", scissors: "paper" };

export function judge(you: Move, cpu: Move): RoundResult {
  if (you === cpu) return "draw";
  return BEATS[you] === cpu ? "win" : "lose";
}

export function randomMove(rng: Rng = cryptoRng): Move {
  return MOVES[Math.floor(rng() * MOVES.length)] as Move;
}

export interface Match {
  you: number;
  cpu: number;
  /** Rounds needed to win the match. */
  target: number;
  rounds: number;
}

export function newMatch(target = 3): Match {
  return { you: 0, cpu: 0, target, rounds: 0 };
}

export function matchWinner(match: Match): "you" | "cpu" | null {
  if (match.you >= match.target) return "you";
  if (match.cpu >= match.target) return "cpu";
  return null;
}

/** Plays one round and returns the updated match. Throws if the match is already over. */
export function playRound(match: Match, you: Move, cpu: Move): { match: Match; result: RoundResult } {
  if (matchWinner(match)) throw new Error("Match is over");
  const result = judge(you, cpu);
  return {
    result,
    match: {
      ...match,
      rounds: match.rounds + 1,
      you: match.you + (result === "win" ? 1 : 0),
      cpu: match.cpu + (result === "lose" ? 1 : 0),
    },
  };
}
