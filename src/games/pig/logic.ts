import { type Rng, cryptoRng, randomInt } from "../../shared/rng";

export const TARGET = 50;
export type Player = "you" | "cpu";

export interface PigState {
  scores: Record<Player, number>;
  turn: Player;
  turnTotal: number;
  lastRoll: number | null;
  winner: Player | null;
  /** Turns taken by you, used for the "fewest turns" record. */
  yourTurns: number;
}

export function newGame(first: Player = "you"): PigState {
  return { scores: { you: 0, cpu: 0 }, turn: first, turnTotal: 0, lastRoll: null, winner: null, yourTurns: first === "you" ? 1 : 0 };
}

const other = (p: Player): Player => (p === "you" ? "cpu" : "you");

function passTurn(state: PigState): PigState {
  const next = other(state.turn);
  return { ...state, turn: next, turnTotal: 0, yourTurns: state.yourTurns + (next === "you" ? 1 : 0) };
}

/** Rolls the die. A 1 wipes the turn total and passes the turn. */
export function roll(state: PigState, rng: Rng = cryptoRng): PigState {
  if (state.winner) throw new Error("Game over");
  const value = randomInt(1, 6, rng);
  if (value === 1) return { ...passTurn(state), lastRoll: 1 };
  return { ...state, turnTotal: state.turnTotal + value, lastRoll: value };
}

/** Banks the turn total. Reaching the target wins. */
export function bank(state: PigState): PigState {
  if (state.winner) throw new Error("Game over");
  if (state.turnTotal === 0) throw new Error("Nothing to bank");
  const score = state.scores[state.turn] + state.turnTotal;
  const scores = { ...state.scores, [state.turn]: score };
  if (score >= TARGET) return { ...state, scores, turnTotal: 0, winner: state.turn };
  return passTurn({ ...state, scores });
}

/**
 * The computer's choice: keep rolling until the turn is worth 20,
 * push harder when you are close to winning, and always bank a winning total.
 */
export function cpuWantsToRoll(state: PigState): boolean {
  const mine = state.scores.cpu + state.turnTotal;
  if (mine >= TARGET) return false;
  const yourScore = state.scores.you;
  const goal = yourScore >= TARGET - 12 ? TARGET - state.scores.cpu : yourScore - state.scores.cpu > 15 ? 25 : 20;
  return state.turnTotal < goal;
}
