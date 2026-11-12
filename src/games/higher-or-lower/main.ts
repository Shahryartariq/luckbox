import "./style.css";
import { cardLabel, renderCard } from "../../shared/cards";
import { $, shortcuts } from "../../shared/dom";
import { load, remove, save } from "../../shared/storage";
import { announce, initGamePage, initReset, renderStats } from "../../shared/shell";
import { play } from "../../shared/sound";
import { type Call, HigherOrLower } from "./logic";

initGamePage("higher-or-lower");

const DEFAULT_STATS = { bestStreak: 0, runs: 0, rightCalls: 0, wrongCalls: 0 };
let stats = load("higher-or-lower", DEFAULT_STATS);

const slot = $("current-card");
const trail = $("trail");
const higherBtn = $<HTMLButtonElement>("higher");
const lowerBtn = $<HTMLButtonElement>("lower");
const again = $<HTMLButtonElement>("again");

let game = new HigherOrLower();

const pct = (x: number): string => `${Math.round(x * 100)}%`;

function showStats(): void {
  const calls = stats.rightCalls + stats.wrongCalls;
  renderStats([
    { label: "Streak", value: game.streak },
    { label: "Best streak", value: stats.bestStreak },
    { label: "Runs", value: stats.runs },
    { label: "Right calls", value: calls ? pct(stats.rightCalls / calls) : "None yet" },
  ]);
}

function renderBoard(deal: boolean): void {
  slot.replaceChildren(renderCard(game.current, { deal }));
  $("cards-left").textContent = String(game.deck.length);
  const o = game.odds;
  for (const key of ["higher", "same", "lower"] as const) {
    $(`odds-${key}`).textContent = pct(o[key]);
    $(`bar-${key}`).style.width = pct(o[key]);
  }
  // The trail shows the last few cards of the run.
  const recent = game.history.slice(-8, -1);
  trail.replaceChildren(...recent.map((c) => renderCard(c)));
  trail.hidden = recent.length === 0;
  higherBtn.disabled = lowerBtn.disabled = game.over;
  again.hidden = !game.over;
}

function newRun(): void {
  game = new HigherOrLower();
  renderBoard(true);
  showStats();
  announce(`${cardLabel(game.current)}. Higher or lower?`);
}

function call(guess: Call): void {
  if (game.over) return;
  const before = game.current;
  const { card, result } = game.call(guess);
  if (result === "right") {
    stats.rightCalls++;
    stats.bestStreak = Math.max(stats.bestStreak, game.streak);
    announce(`${cardLabel(card)}. Right! Streak of ${game.streak}.`, "win");
    play("flip");
  } else if (result === "tie") {
    announce(`${cardLabel(card)}, same rank as the ${cardLabel(before)}. Tie, keep going.`, "push");
    play("push");
  } else {
    stats.wrongCalls++;
    stats.runs++;
    const streak = game.streak;
    announce(
      `${cardLabel(card)}. Wrong call. Your run ends at ${streak}${streak > 0 && streak === stats.bestStreak ? ", a new best" : ""}.`,
      "lose",
    );
    play("lose");
  }
  save("higher-or-lower", stats);
  renderBoard(true);
  showStats();
  if (game.over) again.focus();
}

higherBtn.addEventListener("click", () => call("higher"));
lowerBtn.addEventListener("click", () => call("lower"));
again.addEventListener("click", newRun);
shortcuts({
  arrowup: () => call("higher"),
  arrowdown: () => call("lower"),
  h: () => call("higher"),
  l: () => call("lower"),
  n: () => {
    if (game.over) newRun();
  },
});
initReset(() => {
  remove("higher-or-lower");
  stats = { ...DEFAULT_STATS };
  showStats();
});

newRun();
