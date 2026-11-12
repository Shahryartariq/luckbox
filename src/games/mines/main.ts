import "./style.css";
import { $, pulse, shortcuts } from "../../shared/dom";
import { load, remove, save } from "../../shared/storage";
import { announce, initGamePage, initReset, renderStats } from "../../shared/shell";
import { play } from "../../shared/sound";
import { MINE_OPTIONS, MinesRound, type RoundStatus, SIZE, STAKE, STARTING_POINTS, safeChance } from "./logic";

initGamePage("mines");

const DEFAULT_STATS = { points: STARTING_POINTS, mines: 3, rounds: 0, cashOuts: 0, bestMultiplier: 0, mostPoints: STARTING_POINTS };
let stats = load("mines", DEFAULT_STATS);
let mines: number = (MINE_OPTIONS as readonly number[]).includes(stats.mines) ? stats.mines : 3;

const grid = $("grid");
const optionsBox = $("mine-options");
const cashBtn = $<HTMLButtonElement>("cash-out");
const newBtn = $<HTMLButtonElement>("new-round");
const refillBtn = $<HTMLButtonElement>("refill");
const multEl = $("multiplier");
const nextEl = $("next-info");

let round: MinesRound | null = null;
const tiles: HTMLButtonElement[] = [];

const fmt = (m: number): string => `${m.toFixed(2)}×`;

function showStats(): void {
  renderStats([
    { label: "Points", value: stats.points },
    { label: "Most points", value: stats.mostPoints },
    { label: "Best cash-out", value: stats.bestMultiplier ? fmt(stats.bestMultiplier) : "None yet" },
    { label: "Rounds", value: stats.rounds },
  ]);
}

function persist(): void {
  stats.mines = mines;
  stats.mostPoints = Math.max(stats.mostPoints, stats.points);
  save("mines", stats);
  showStats();
}

function buildGrid(): void {
  for (let i = 0; i < SIZE; i++) {
    const row = Math.floor(i / 5) + 1;
    const col = (i % 5) + 1;
    const b = document.createElement("button");
    b.type = "button";
    b.className = "tile";
    b.dataset.index = String(i);
    b.setAttribute("aria-label", `Tile row ${row}, column ${col}`);
    b.addEventListener("click", () => reveal(i));
    b.addEventListener("keydown", (e) => moveFocus(e, i));
    tiles.push(b);
  }
  // Five rows for screen readers using the grid role.
  for (let r = 0; r < 5; r++) {
    const rowEl = document.createElement("div");
    rowEl.setAttribute("role", "row");
    rowEl.className = "mines-row";
    for (const t of tiles.slice(r * 5, r * 5 + 5)) {
      const cell = document.createElement("div");
      cell.setAttribute("role", "gridcell");
      cell.append(t);
      rowEl.append(cell);
    }
    grid.append(rowEl);
  }
}

/** Arrow keys move around the board. */
function moveFocus(e: KeyboardEvent, i: number): void {
  const delta: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 5, ArrowUp: -5 };
  const d = delta[e.key];
  if (d === undefined) return;
  const next = i + d;
  if (next < 0 || next >= SIZE) return;
  if ((d === 1 || d === -1) && Math.floor(next / 5) !== Math.floor(i / 5)) return;
  e.preventDefault();
  tiles[next]?.focus();
}

function renderOptions(): void {
  const locked = !!round && round.status === "playing" && round.safeCount > 0;
  optionsBox.replaceChildren(
    ...MINE_OPTIONS.map((n) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = String(n);
      b.setAttribute("aria-label", `${n} mines`);
      b.setAttribute("aria-pressed", String(n === mines));
      b.disabled = locked;
      b.addEventListener("click", () => {
        mines = n;
        persist();
        startRound();
      });
      return b;
    }),
  );
}

function render(): void {
  const r = round;
  tiles.forEach((t, i) => {
    const revealedSafe = !!r && r.revealed.has(i);
    const over = !!r && r.status !== "playing";
    const isMine = !!r && r.mineAt.has(i);
    t.dataset.state = revealedSafe ? "gem" : over && isMine ? (r.hit === i ? "boom" : "mine") : over ? "dim" : "hidden";
    t.textContent = revealedSafe ? "◆" : over && isMine ? "✸" : "";
    t.disabled = !r || r.status !== "playing" || revealedSafe;
    const row = Math.floor(i / 5) + 1;
    const col = (i % 5) + 1;
    const what = revealedSafe ? "safe" : over && isMine ? "mine" : "hidden";
    t.setAttribute("aria-label", `Row ${row}, column ${col}, ${what}`);
  });
  if (r) {
    multEl.textContent = fmt(r.multiplier);
    if (r.status === "playing") {
      nextEl.textContent = `Next tile: ${fmt(r.nextMultiplier)}, ${Math.round(safeChance(r.mines, r.safeCount) * 100)}% safe`;
    } else nextEl.textContent = "";
    cashBtn.disabled = r.status !== "playing" || r.safeCount === 0;
    cashBtn.innerHTML = r.status === "playing" && r.safeCount > 0 ? `Cash out ${r.payout} <kbd>C</kbd>` : "Cash out <kbd>C</kbd>";
  }
  const broke = stats.points < STAKE && (!r || r.status !== "playing");
  refillBtn.hidden = !broke;
  newBtn.hidden = broke;
  renderOptions();
}

function startRound(): void {
  // Starting over before any tile is flipped is free; the stake is only taken on the first flip.
  if (stats.points < STAKE) {
    round = null;
    render();
    announce("You're out of points. Refill to keep playing.", "lose");
    return;
  }
  round = new MinesRound(mines, STAKE);
  render();
  announce(`${mines} mines are hidden. Flip a tile. Each round costs ${STAKE} points.`);
}

function reveal(i: number): void {
  const r = round;
  if (!r || r.status !== "playing") return;
  if (r.safeCount === 0) {
    stats.points -= STAKE;
    stats.rounds++;
  }
  const result = r.reveal(i);
  // reveal() can end the round, so read the status again.
  const status = r.status as RoundStatus;
  if (result === "mine") {
    play("boom");
    pulse(grid, "shake");
    announce(`Boom. You hit a mine at ${fmt(r.multiplier)} and lose ${STAKE} points.`, "lose");
  } else if (status === "cashed") {
    const paid = r.payout;
    stats.points += paid;
    stats.cashOuts++;
    stats.bestMultiplier = Math.max(stats.bestMultiplier, r.multiplier);
    play("win");
    announce(`Board cleared! ${fmt(r.multiplier)} pays ${paid} points.`, "win");
  } else {
    play("flip");
    announce(`Safe. ${fmt(r.multiplier)} now, worth ${r.payout} points.`);
  }
  persist();
  render();
  if (status !== "playing") newBtn.focus();
}

function cashOut(): void {
  const r = round;
  if (!r || r.status !== "playing" || r.safeCount === 0) return;
  const paid = r.cashOut();
  stats.points += paid;
  stats.cashOuts++;
  stats.bestMultiplier = Math.max(stats.bestMultiplier, r.multiplier);
  play("win");
  announce(`Cashed out at ${fmt(r.multiplier)} for ${paid} points.`, "win");
  persist();
  render();
  newBtn.focus();
}

cashBtn.addEventListener("click", cashOut);
newBtn.addEventListener("click", () => {
  if (round && round.status === "playing" && round.safeCount > 0) {
    announce("Cash out or finish this round first.");
    return;
  }
  startRound();
});
refillBtn.addEventListener("click", () => {
  stats.points = STARTING_POINTS;
  persist();
  startRound();
  newBtn.focus();
});
shortcuts({
  c: cashOut,
  n: () => {
    if (!round || round.status !== "playing" || round.safeCount === 0) startRound();
  },
});
initReset(() => {
  remove("mines");
  stats = { ...DEFAULT_STATS, mines };
  persist();
  if (!round || round.status !== "playing" || round.safeCount === 0) startRound();
});

buildGrid();
showStats();
startRound();
