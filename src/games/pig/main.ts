import "./style.css";
import { $, pulse, shortcuts, wait } from "../../shared/dom";
import { load, remove, save } from "../../shared/storage";
import { announce, initGamePage, initReset, renderStats } from "../../shared/shell";
import { play } from "../../shared/sound";
import { type PigState, TARGET, bank, cpuWantsToRoll, newGame, roll } from "./logic";

initGamePage("pig");

const DEFAULT_STATS = { wins: 0, losses: 0, fewestTurns: 0, biggestTurn: 0 };
let stats = load("pig", DEFAULT_STATS);

const die = $("die");
const rollBtn = $<HTMLButtonElement>("roll");
const bankBtn = $<HTMLButtonElement>("bank");
const again = $<HTMLButtonElement>("again");

let state: PigState = newGame();
let busy = false;

/** Pip positions on a 3x3 grid for each face. */
const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

function showStats(): void {
  renderStats([
    { label: "Wins", value: stats.wins },
    { label: "Losses", value: stats.losses },
    { label: "Fewest turns", value: stats.fewestTurns || "None yet" },
    { label: "Best turn", value: stats.biggestTurn },
  ]);
}

function drawDie(value: number | null): void {
  die.replaceChildren(
    ...Array.from({ length: 9 }, (_, i) => {
      const cell = document.createElement("span");
      if (value && PIPS[value]?.includes(i)) cell.className = "pip";
      return cell;
    }),
  );
  die.dataset.bad = String(value === 1);
  die.setAttribute("aria-label", value ? `Die shows ${value}` : "Die not rolled yet");
}

function render(): void {
  for (const who of ["you", "cpu"] as const) {
    $(`${who}-score`).textContent = String(state.scores[who]);
    $(`${who}-bar`).style.width = `${Math.min(100, (state.scores[who] / TARGET) * 100)}%`;
    $(`${who}-box`).dataset.active = String(state.turn === who && !state.winner);
  }
  $("turn-total").textContent = String(state.turnTotal);
  const yourMove = state.turn === "you" && !state.winner && !busy;
  rollBtn.disabled = !yourMove;
  bankBtn.disabled = !yourMove || state.turnTotal === 0;
  again.hidden = !state.winner;
}

function finish(): void {
  if (state.winner === "you") {
    stats.wins++;
    if (!stats.fewestTurns || state.yourTurns < stats.fewestTurns) stats.fewestTurns = state.yourTurns;
    announce(`You win ${state.scores.you} to ${state.scores.cpu} in ${state.yourTurns} turns!`, "win");
    play("win");
  } else {
    stats.losses++;
    announce(`The computer wins ${state.scores.cpu} to ${state.scores.you}.`, "lose");
    play("lose");
  }
  save("pig", stats);
  showStats();
  render();
  again.focus();
}

async function animateRoll(): Promise<void> {
  pulse(die, "rolling");
  play("tap");
  await wait(380);
}

async function cpuTurn(): Promise<void> {
  busy = true;
  render();
  announce("Computer's turn.");
  await wait(700);
  while (state.turn === "cpu" && !state.winner) {
    if (state.turnTotal > 0 && !cpuWantsToRoll(state)) {
      const banked = state.turnTotal;
      state = bank(state);
      announce(`Computer banks ${banked}.`);
      play("push");
      render();
      await wait(800);
      break;
    }
    await animateRoll();
    state = roll(state);
    drawDie(state.lastRoll);
    if (state.lastRoll === 1) {
      announce("Computer rolled a 1 and loses the turn.", "win");
      play("lose");
      render();
      await wait(900);
      break;
    }
    announce(`Computer rolled ${state.lastRoll}. Turn total ${state.turnTotal}.`);
    render();
    await wait(650);
  }
  busy = false;
  if (state.winner) return finish();
  render();
  announce("Your turn. Roll the die.");
  rollBtn.focus();
}

async function onRoll(): Promise<void> {
  if (busy || state.turn !== "you" || state.winner) return;
  busy = true;
  render();
  await animateRoll();
  state = roll(state);
  drawDie(state.lastRoll);
  busy = false;
  if (state.lastRoll === 1) {
    announce("You rolled a 1. This turn's points are gone.", "lose");
    play("lose");
    render();
    await wait(700);
    return cpuTurn();
  }
  stats.biggestTurn = Math.max(stats.biggestTurn, state.turnTotal);
  save("pig", stats);
  showStats();
  announce(`You rolled ${state.lastRoll}. This turn: ${state.turnTotal}. Roll again or bank?`);
  render();
}

async function onBank(): Promise<void> {
  if (busy || state.turn !== "you" || state.turnTotal === 0 || state.winner) return;
  const banked = state.turnTotal;
  state = bank(state);
  play("push");
  render();
  if (state.winner) return finish();
  announce(`You bank ${banked}.`);
  await wait(500);
  return cpuTurn();
}

function start(): void {
  state = newGame();
  busy = false;
  drawDie(null);
  render();
  announce(`First to ${TARGET}. You go first. Roll the die.`);
}

rollBtn.addEventListener("click", () => void onRoll());
bankBtn.addEventListener("click", () => void onBank());
again.addEventListener("click", start);
shortcuts({
  r: () => void onRoll(),
  b: () => void onBank(),
  n: () => {
    if (state.winner) start();
  },
});
initReset(() => {
  remove("pig");
  stats = { ...DEFAULT_STATS };
  showStats();
});

showStats();
start();
