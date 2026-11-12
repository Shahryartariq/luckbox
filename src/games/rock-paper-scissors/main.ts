import "./style.css";
import { $, pulse, shortcuts, wait } from "../../shared/dom";
import { load, remove, save } from "../../shared/storage";
import { announce, initGamePage, initReset, renderStats } from "../../shared/shell";
import { play } from "../../shared/sound";
import { type Match, type Move, matchWinner, newMatch, playRound, randomMove } from "./logic";

initGamePage("rock-paper-scissors");

const ICON: Record<Move, string> = { rock: "✊", paper: "✋", scissors: "✌️" };
const NAME: Record<Move, string> = { rock: "Rock", paper: "Paper", scissors: "Scissors" };

const DEFAULT_STATS = { matchesWon: 0, matchesLost: 0, rounds: 0, streak: 0, bestStreak: 0 };
let stats = load("rock-paper-scissors", DEFAULT_STATS);

const youHand = $("you-hand");
const cpuHand = $("cpu-hand");
const youScore = $("you-score");
const cpuScore = $("cpu-score");
const log = $("log");
const again = $<HTMLButtonElement>("again");
const moveButtons = [...document.querySelectorAll<HTMLButtonElement>("#moves [data-move]")];

let match: Match = newMatch();
let busy = false;

function showStats(): void {
  renderStats([
    { label: "Matches won", value: stats.matchesWon },
    { label: "Matches lost", value: stats.matchesLost },
    { label: "Win streak", value: stats.streak },
    { label: "Best streak", value: stats.bestStreak },
  ]);
}

function setMovesEnabled(on: boolean): void {
  moveButtons.forEach((b) => (b.disabled = !on));
}

function reset(): void {
  match = newMatch();
  youScore.textContent = "0";
  cpuScore.textContent = "0";
  youHand.textContent = cpuHand.textContent = "✊";
  youHand.setAttribute("aria-label", "Waiting for your move");
  cpuHand.setAttribute("aria-label", "Waiting");
  youHand.dataset.result = cpuHand.dataset.result = "";
  log.replaceChildren();
  again.hidden = true;
  setMovesEnabled(true);
  announce("First to 3 wins. Make your move.");
}

async function choose(move: Move): Promise<void> {
  if (busy || matchWinner(match)) return;
  busy = true;
  setMovesEnabled(false);
  play("tap");

  // Count-in shake, then reveal both hands together.
  youHand.textContent = cpuHand.textContent = "✊";
  youHand.dataset.result = cpuHand.dataset.result = "";
  announce("Rock, paper, scissors…");
  pulse(youHand, "shake");
  pulse(cpuHand, "shake");
  await wait(620);

  const cpu = randomMove();
  const { match: next, result } = playRound(match, move, cpu);
  match = next;
  stats.rounds++;

  youHand.textContent = ICON[move];
  cpuHand.textContent = ICON[cpu];
  youHand.setAttribute("aria-label", `You played ${NAME[move]}`);
  cpuHand.setAttribute("aria-label", `Computer played ${NAME[cpu]}`);
  youHand.dataset.result = result === "win" ? "win" : result === "lose" ? "lose" : "draw";
  cpuHand.dataset.result = result === "win" ? "lose" : result === "lose" ? "win" : "draw";
  youScore.textContent = String(match.you);
  cpuScore.textContent = String(match.cpu);

  const item = document.createElement("li");
  item.dataset.result = result;
  item.textContent = `${ICON[move]} vs ${ICON[cpu]}`;
  item.title = result === "win" ? "Round won" : result === "lose" ? "Round lost" : "Draw";
  log.append(item);

  const winner = matchWinner(match);
  if (winner === "you") {
    stats.matchesWon++;
    stats.streak++;
    stats.bestStreak = Math.max(stats.bestStreak, stats.streak);
    announce(`You win the match ${match.you} to ${match.cpu}!`, "win");
    play("win");
  } else if (winner === "cpu") {
    stats.matchesLost++;
    stats.streak = 0;
    announce(`The computer wins the match ${match.cpu} to ${match.you}.`, "lose");
    play("lose");
  } else if (result === "draw") {
    announce(`Both played ${NAME[move]}. Draw, go again.`, "push");
    play("push");
  } else if (result === "win") {
    announce(`${NAME[move]} beats ${NAME[cpu]}. Point to you.`, "win");
    play("flip");
  } else {
    announce(`${NAME[cpu]} beats ${NAME[move]}. Point to the computer.`, "lose");
    play("flip");
  }

  save("rock-paper-scissors", stats);
  showStats();
  if (winner) {
    again.hidden = false;
    again.focus();
  } else {
    setMovesEnabled(true);
  }
  busy = false;
}

moveButtons.forEach((btn) => btn.addEventListener("click", () => void choose(btn.dataset.move as Move)));
again.addEventListener("click", reset);
shortcuts({
  r: () => void choose("rock"),
  p: () => void choose("paper"),
  s: () => void choose("scissors"),
  n: () => {
    if (matchWinner(match)) reset();
  },
});
initReset(() => {
  remove("rock-paper-scissors");
  stats = { ...DEFAULT_STATS };
  showStats();
});

showStats();
reset();
