import "./style.css";
import { $, isTyping, prefersReducedMotion, pulse } from "../../shared/dom";
import { load, remove, save } from "../../shared/storage";
import { announce, initGamePage, initReset, renderStats } from "../../shared/shell";
import { play } from "../../shared/sound";
import { type Direction, Game2048, SIZE, type Tile, WIN_VALUE } from "./logic";

initGamePage("2048");

const DEFAULT_STATS = { bestScore: 0, bestTile: 0, games: 0, wins: 0 };
let stats = load("2048", DEFAULT_STATS);

const tilesEl = $("tiles");
const board = $("board");
const scoreEl = $("score");
const bestEl = $("best-score");
const overlay = $("overlay");
const overlayText = $("overlay-text");
const keepGoing = $<HTMLButtonElement>("keep-going");
const tryAgain = $<HTMLButtonElement>("try-again");
const newBtn = $<HTMLButtonElement>("new-game");
const newLabel = $("new-game-label");
const boardText = $("board-text");

const els = new Map<number, HTMLElement>();
let game = new Game2048();
let counted = false;

const slideMs = (): number => (prefersReducedMotion() ? 0 : 110);

function showStats(): void {
  renderStats([
    { label: "Best score", value: stats.bestScore },
    { label: "Biggest tile", value: stats.bestTile || "None yet" },
    { label: "Games", value: stats.games },
    { label: "Reached 2048", value: stats.wins },
  ]);
}

function persist(): void {
  save("2048-game", { tiles: game.tiles.map(({ value, row, col }) => ({ value, row, col })), score: game.score, won: game.won });
}

function place(el: HTMLElement, row: number, col: number): void {
  el.style.setProperty("--r", String(row));
  el.style.setProperty("--c", String(col));
}

function setValue(el: HTMLElement, value: number): void {
  el.textContent = String(value);
  el.dataset.value = String(Math.min(value, 4096));
  el.dataset.digits = String(String(value).length);
}

function makeTile(t: Tile, isNew: boolean): HTMLElement {
  const el = document.createElement("div");
  el.className = "g2-tile";
  if (isNew) el.classList.add("is-new");
  el.setAttribute("aria-hidden", "true");
  setValue(el, t.value);
  place(el, t.row, t.col);
  tilesEl.append(el);
  els.set(t.id, el);
  return el;
}

/** Text version of the board for screen readers. */
function describeBoard(): void {
  const rows: string[] = [];
  for (let r = 0; r < SIZE; r++) {
    const cells = [];
    for (let c = 0; c < SIZE; c++) cells.push(game.tiles.find((t) => t.row === r && t.col === c)?.value ?? "empty");
    rows.push(`Row ${r + 1}: ${cells.join(", ")}.`);
  }
  boardText.textContent = rows.join(" ");
}

function drawAll(): void {
  els.forEach((el) => el.remove());
  els.clear();
  game.tiles.forEach((t) => makeTile(t, true));
  updateScore();
  describeBoard();
}

function updateScore(): void {
  scoreEl.textContent = String(game.score);
  bestEl.textContent = String(Math.max(stats.bestScore, game.score));
}

function showOverlay(kind: "win" | "over" | null): void {
  overlay.hidden = kind === null;
  board.dataset.state = kind ?? "";
  if (kind === "win") {
    overlayText.textContent = "You made 2048!";
    keepGoing.hidden = false;
    tryAgain.textContent = "New game";
    keepGoing.focus();
  } else if (kind === "over") {
    overlayText.textContent = "Game over";
    keepGoing.hidden = true;
    tryAgain.textContent = "Try again";
    tryAgain.focus();
  }
}

function recordEnd(): void {
  if (counted) return;
  counted = true;
  stats.games++;
  save("2048", stats);
  showStats();
}

function go(dir: Direction): void {
  if (!overlay.hidden) return;
  const prevBest = game.best;
  const result = game.play(dir);
  if (!result) {
    pulse(board, "nudge");
    return;
  }
  const ms = slideMs();

  // Merged-away tiles slide onto their partner, then disappear.
  for (const a of result.absorbed) {
    const el = els.get(a.id);
    if (!el) continue;
    els.delete(a.id);
    place(el, a.row, a.col);
    el.classList.add("is-absorbed");
    window.setTimeout(() => el.remove(), ms);
  }
  const merged = new Set(result.merged);
  for (const t of game.tiles) {
    const existing = els.get(t.id);
    if (!existing) {
      makeTile(t, true);
      continue;
    }
    place(existing, t.row, t.col);
    if (merged.has(t.id)) {
      const value = t.value;
      window.setTimeout(() => {
        setValue(existing, value);
        pulse(existing, "is-merged");
      }, ms);
    }
  }

  play(result.gained >= 128 ? "win" : result.gained > 0 ? "flip" : "tap");
  stats.bestScore = Math.max(stats.bestScore, game.score);
  stats.bestTile = Math.max(stats.bestTile, game.best);
  updateScore();
  describeBoard();

  if (game.best > prevBest && game.best >= 128) announce(`New biggest tile: ${game.best}.`, "win");
  else if (result.gained > 0) announce(`+${result.gained}. Score ${game.score}.`);
  else announce(`Score ${game.score}.`);

  if (result.reachedWin) {
    stats.wins++;
    announce(`You made ${WIN_VALUE}! Keep going or start a new game.`, "win");
    play("win");
    window.setTimeout(() => showOverlay("win"), ms + 150);
  }
  if (game.over) {
    recordEnd();
    announce(`No moves left. Final score ${game.score}.`, "lose");
    play("lose");
    window.setTimeout(() => showOverlay("over"), ms + 250);
  }
  save("2048", stats);
  showStats();
  persist();
}

let armed = false;
let armTimer: number | undefined;
function newGame(force = false): void {
  // Starting over mid-game asks for a second press, so a stray N doesn't wipe a good run.
  const inProgress = game.score > 0 && !game.over;
  if (inProgress && !force && !armed) {
    armed = true;
    newLabel.textContent = "Press again to restart";
    armTimer = window.setTimeout(() => {
      armed = false;
      newLabel.textContent = "New game";
    }, 3000);
    return;
  }
  window.clearTimeout(armTimer);
  armed = false;
  newLabel.textContent = "New game";
  if (inProgress) recordEnd();
  game = new Game2048();
  counted = false;
  showOverlay(null);
  drawAll();
  persist();
  announce("New game. Slide the tiles to merge equal numbers.");
}

// Keyboard: arrow keys or WASD.
const KEYS: Record<string, Direction> = {
  ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
  w: "up", s: "down", a: "left", d: "right",
};
document.addEventListener("keydown", (e) => {
  if (isTyping(e)) return;
  const dir = KEYS[e.key] ?? KEYS[e.key.toLowerCase()];
  if (dir) {
    e.preventDefault();
    go(dir);
  } else if (e.key.toLowerCase() === "n") {
    newGame();
  }
});

// Swipe on touch screens and with a mouse drag.
let start: { x: number; y: number; id: number } | null = null;
board.addEventListener("pointerdown", (e) => {
  start = { x: e.clientX, y: e.clientY, id: e.pointerId };
});
board.addEventListener("pointerup", (e) => {
  if (!start || start.id !== e.pointerId) return;
  const dx = e.clientX - start.x;
  const dy = e.clientY - start.y;
  start = null;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
  go(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up");
});
board.addEventListener("pointercancel", () => (start = null));

document.querySelectorAll<HTMLButtonElement>("[data-dir]").forEach((b) =>
  b.addEventListener("click", () => go(b.dataset.dir as Direction)),
);
newBtn.addEventListener("click", () => newGame());
keepGoing.addEventListener("click", () => {
  showOverlay(null);
  announce("Keep going. How far can you get?");
  board.focus();
});
tryAgain.addEventListener("click", () => newGame(true));

initReset(() => {
  remove("2048");
  stats = { ...DEFAULT_STATS };
  updateScore();
  showStats();
});

function resume(): boolean {
  const saved = load("2048-game", { tiles: [] as unknown[], score: 0, won: false });
  const g = new Game2048();
  if (!g.restore(saved) || g.over) return false;
  game = g;
  return true;
}

showStats();
const resumed = resume();
drawAll();
announce(
  resumed
    ? `Welcome back. Your game is where you left it, score ${game.score}.`
    : "Slide the tiles with the arrow keys or by swiping. Equal numbers merge.",
);
