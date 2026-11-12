import "./style.css";
import { $, shortcuts } from "../../shared/dom";
import { load, remove, save } from "../../shared/storage";
import { announce, initGamePage, initReset, renderStats } from "../../shared/shell";
import { play } from "../../shared/sound";
import { LEVELS, type Level, NumberGuess, perfectTries } from "./logic";

initGamePage("number-guess");

const DEFAULT_STATS = { wins: 0, losses: 0, bestEasy: 0, bestNormal: 0, bestHard: 0, level: "normal" };
let stats = load("number-guess", DEFAULT_STATS);
const startLevel: Level = stats.level in LEVELS ? (stats.level as Level) : "normal";

const form = $<HTMLFormElement>("guess-form");
const input = $<HTMLInputElement>("guess-input");
const error = $("input-error");
const history = $("history");
const levels = $("levels");
const windowEl = $("ng-window");
const guessBtn = $<HTMLButtonElement>("guess-btn");

let game = new NumberGuess(startLevel);

const bestKey = (level: Level): "bestEasy" | "bestNormal" | "bestHard" =>
  level === "easy" ? "bestEasy" : level === "normal" ? "bestNormal" : "bestHard";

function showStats(): void {
  const best = (n: number): string => (n ? `${n} tries` : "None yet");
  renderStats([
    { label: "Wins", value: stats.wins },
    { label: "Losses", value: stats.losses },
    { label: "Best on easy", value: best(stats.bestEasy) },
    { label: "Best on normal", value: best(stats.bestNormal) },
    { label: "Best on hard", value: best(stats.bestHard) },
  ]);
}

function renderLevels(): void {
  levels.replaceChildren(
    ...(Object.keys(LEVELS) as Level[]).map((level) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = `${LEVELS[level].label}: 1 to ${LEVELS[level].max}`;
      b.setAttribute("aria-pressed", String(level === game.level));
      b.addEventListener("click", () => start(level));
      return b;
    }),
  );
}

function render(): void {
  const { low, high, max } = game;
  $("possible").textContent = low === high ? String(low) : `${low} to ${high}`;
  $("tries-left").textContent = String(game.triesLeft);
  $("range-text").textContent = `1 to ${max}`;
  $("ng-max").textContent = String(max);
  input.max = String(max);
  // The highlighted window shows the numbers that are still possible.
  windowEl.style.left = `${((low - 1) / max) * 100}%`;
  windowEl.style.width = `${Math.max(((high - low + 1) / max) * 100, 0.8)}%`;
  windowEl.dataset.state = game.status;
  const playing = game.status === "playing";
  input.disabled = !playing;
  guessBtn.disabled = !playing;
}

function start(level: Level): void {
  game = new NumberGuess(level);
  stats.level = level;
  save("number-guess", stats);
  history.replaceChildren();
  error.textContent = "";
  input.value = "";
  renderLevels();
  render();
  announce(`I picked a number from 1 to ${game.max}. You have ${game.tries} tries. A perfect player needs at most ${perfectTries(game.max)}.`);
  input.focus({ preventScroll: true });
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const raw = input.value.trim();
  const value = raw === "" ? NaN : Number(raw);
  const problem = game.validate(value);
  if (problem) {
    error.textContent = problem;
    input.setAttribute("aria-invalid", "true");
    return;
  }
  error.textContent = "";
  input.removeAttribute("aria-invalid");
  const result = game.guess(value);

  const li = document.createElement("li");
  li.dataset.result = result;
  li.textContent = result === "correct" ? `${value} ✓` : `${value} ${result === "higher" ? "↑" : "↓"}`;
  li.title = result === "correct" ? "Correct" : `Go ${result}`;
  history.append(li);

  if (game.status === "won") {
    const used = game.guesses.length;
    stats.wins++;
    const key = bestKey(game.level);
    if (!stats[key] || used < stats[key]) stats[key] = used;
    announce(`Got it! ${value} in ${used} ${used === 1 ? "try" : "tries"}.`, "win");
    play("win");
  } else if (game.status === "lost") {
    stats.losses++;
    announce(`Out of tries. The number was ${game.secret}.`, "lose");
    play("lose");
  } else {
    announce(`${value} is too ${result === "higher" ? "low. Go higher" : "high. Go lower"}.`, "info");
    play("tap");
  }
  save("number-guess", stats);
  showStats();
  render();
  input.value = "";
  if (game.status === "playing") input.focus();
  else $("again").focus();
});

$("again").addEventListener("click", () => start(game.level));
shortcuts({ n: () => start(game.level) });
initReset(() => {
  remove("number-guess");
  stats = { ...DEFAULT_STATS, level: game.level };
  showStats();
});

showStats();
start(startLevel);
