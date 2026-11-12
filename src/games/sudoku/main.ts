import "./style.css";
import { $, isTyping } from "../../shared/dom";
import { load, remove, save } from "../../shared/storage";
import { announce, initGamePage, initReset, renderStats } from "../../shared/shell";
import { play } from "../../shared/sound";
import { type Board, LEVELS, type Level, colOf, peersOf, conflicts, formatTime, generate, isSolved, rowOf } from "./logic";

initGamePage("sudoku");

const DEFAULT_STATS = { solved: 0, bestEasy: 0, bestMedium: 0, bestHard: 0, level: "easy" };
let stats = load("sudoku", DEFAULT_STATS);

interface SavedGame {
  puzzle: number[];
  solution: number[];
  values: number[];
  notes: number[];
  level: string;
  elapsed: number;
  hints: number;
  done: boolean;
}
const EMPTY_GAME: SavedGame = { puzzle: [], solution: [], values: [], notes: [], level: "easy", elapsed: 0, hints: 0, done: false };

const isLevel = (x: string): x is Level => x in LEVELS;
const validBoard = (b: unknown): b is number[] =>
  Array.isArray(b) && b.length === 81 && b.every((v) => Number.isInteger(v) && v >= 0 && v <= 9);

interface Move {
  cell: number;
  value: number;
  notes: number;
}

let puzzle: Board = [];
let solution: Board = [];
let values: Board = [];
/** Pencil marks as a bitmask per cell: bit n set means n is noted. */
let notes: number[] = [];
let level: Level = isLevel(stats.level) ? stats.level : "easy";
let elapsed = 0;
let hints = 0;
let done = false;
let selected = 40;
let notesMode = false;
let history: Move[] = [];
let timer: number | undefined;

const boardEl = $("board");
const padEl = $("pad");
const timerEl = $("timer");
const notesBtn = $<HTMLButtonElement>("notes");
const cells: HTMLButtonElement[] = [];

const bestKey = (l: Level): "bestEasy" | "bestMedium" | "bestHard" =>
  l === "easy" ? "bestEasy" : l === "medium" ? "bestMedium" : "bestHard";

function showStats(): void {
  const best = (s: number): string => (s ? formatTime(s) : "None yet");
  renderStats([
    { label: "Solved", value: stats.solved },
    { label: "Best easy", value: best(stats.bestEasy) },
    { label: "Best medium", value: best(stats.bestMedium) },
    { label: "Best hard", value: best(stats.bestHard) },
  ]);
}

function persistGame(): void {
  save("sudoku-game", { puzzle, solution, values, notes, level, elapsed, hints, done } satisfies SavedGame);
}

function buildBoard(): void {
  for (let r = 0; r < 9; r++) {
    const row = document.createElement("div");
    row.setAttribute("role", "row");
    row.className = "sd-row";
    for (let c = 0; c < 9; c++) {
      const i = r * 9 + c;
      const gridcell = document.createElement("div");
      gridcell.setAttribute("role", "gridcell");
      gridcell.className = "sd-gridcell";
      const b = document.createElement("button");
      b.type = "button";
      b.className = "sd-cell";
      b.dataset.index = String(i);
      if (c % 3 === 2 && c < 8) b.classList.add("sd-cell--box-right");
      if (r % 3 === 2 && r < 8) b.classList.add("sd-cell--box-bottom");
      b.addEventListener("click", () => select(i));
      gridcell.append(b);
      row.append(gridcell);
      cells.push(b);
    }
    boardEl.append(row);
  }
  padEl.replaceChildren(
    ...Array.from({ length: 9 }, (_, k) => {
      const n = k + 1;
      const b = document.createElement("button");
      b.type = "button";
      b.className = "sd-key";
      b.dataset.n = String(n);
      b.addEventListener("click", () => input(n));
      return b;
    }),
  );
}

function render(): void {
  const bad = conflicts(values);
  const sel = values[selected] ?? 0;
  const peers = new Set(peersOf(selected));
  cells.forEach((b, i) => {
    const v = values[i] ?? 0;
    const given = puzzle[i] !== 0;
    b.classList.toggle("is-given", given);
    b.classList.toggle("is-selected", i === selected);
    b.classList.toggle("is-peer", peers.has(i));
    b.classList.toggle("is-same", sel !== 0 && v === sel && i !== selected);
    b.classList.toggle("is-conflict", bad.has(i) && !given);
    b.tabIndex = i === selected ? 0 : -1;
    if (v) {
      b.textContent = String(v);
    } else if (notes[i]) {
      const mask = notes[i] ?? 0;
      const grid = document.createElement("span");
      grid.className = "sd-notes";
      for (let n = 1; n <= 9; n++) {
        const s = document.createElement("span");
        s.textContent = (mask >> n) & 1 ? String(n) : "";
        grid.append(s);
      }
      b.replaceChildren(grid);
    } else {
      b.textContent = "";
    }
    const noted = [];
    for (let n = 1; n <= 9; n++) if (((notes[i] ?? 0) >> n) & 1) noted.push(n);
    const what = v ? `${v}${given ? ", given" : ""}${bad.has(i) && !given ? ", clashes" : ""}` : noted.length ? `notes ${noted.join(" ")}` : "empty";
    b.setAttribute("aria-label", `Row ${rowOf(i) + 1}, column ${colOf(i) + 1}, ${what}`);
    b.parentElement?.setAttribute("aria-selected", String(i === selected));
  });
  // Number pad shows how many of each digit are still to place.
  padEl.querySelectorAll<HTMLButtonElement>(".sd-key").forEach((b) => {
    const n = Number(b.dataset.n);
    const left = 9 - values.filter((v) => v === n).length;
    b.innerHTML = `<span class="sd-key__n">${n}</span><span class="sd-key__left">${left > 0 ? left : "✓"}</span>`;
    b.setAttribute("aria-label", `${notesMode ? "Note" : "Place"} ${n}, ${Math.max(left, 0)} left`);
    b.disabled = done;
  });
  notesBtn.setAttribute("aria-pressed", String(notesMode));
  notesBtn.setAttribute("aria-label", `Notes ${notesMode ? "on" : "off"}`);
  for (const id of ["notes", "erase", "undo", "hint"]) $<HTMLButtonElement>(id).disabled = done;
  $<HTMLButtonElement>("undo").disabled = done || history.length === 0;
  timerEl.textContent = formatTime(elapsed);
  boardEl.dataset.done = String(done);
}

function renderLevels(): void {
  const box = $("levels");
  box.replaceChildren(
    ...(Object.keys(LEVELS) as Level[]).map((l) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = LEVELS[l].label;
      b.setAttribute("aria-pressed", String(l === level));
      b.addEventListener("click", () => newPuzzle(l));
      return b;
    }),
  );
}

function tick(): void {
  if (done || document.hidden) return;
  elapsed++;
  timerEl.textContent = formatTime(elapsed);
  if (elapsed % 5 === 0) persistGame();
}

function startTimer(): void {
  window.clearInterval(timer);
  timer = window.setInterval(tick, 1000);
}

function select(i: number, focus = true): void {
  selected = i;
  render();
  if (focus) cells[i]?.focus();
}

function setCell(i: number, value: number, cellNotes: number): void {
  history.push({ cell: i, value: values[i] ?? 0, notes: notes[i] ?? 0 });
  if (history.length > 500) history.shift();
  values[i] = value;
  notes[i] = cellNotes;
}

/** Placing a number clears that number from the notes of every peer. */
function clearPeerNotes(i: number, n: number): void {
  for (const p of peersOf(i)) notes[p] = (notes[p] ?? 0) & ~(1 << n);
}

function input(n: number): void {
  if (done || puzzle[selected] !== 0) {
    if (!done) announce("That number is part of the puzzle and can't change.");
    return;
  }
  if (notesMode) {
    if (values[selected]) return;
    setCell(selected, 0, (notes[selected] ?? 0) ^ (1 << n));
    play("tap");
  } else {
    const same = values[selected] === n;
    setCell(selected, same ? 0 : n, 0);
    if (!same) clearPeerNotes(selected, n);
    play("tap");
  }
  afterChange();
}

function erase(): void {
  if (done || puzzle[selected] !== 0 || (!values[selected] && !notes[selected])) return;
  setCell(selected, 0, 0);
  afterChange();
}

function undo(): void {
  const last = history.pop();
  if (!last || done) return;
  values[last.cell] = last.value;
  notes[last.cell] = last.notes;
  selected = last.cell;
  afterChange();
}

function hint(): void {
  if (done) return;
  let target = selected;
  if (puzzle[target] !== 0 || values[target] === solution[target]) {
    const open = cells.map((_, i) => i).filter((i) => values[i] !== solution[i]);
    if (open.length === 0) return;
    target = open[Math.floor(Math.random() * open.length)] ?? target;
  }
  const answer = solution[target] ?? 0;
  selected = target;
  hints++;
  setCell(target, answer, 0);
  clearPeerNotes(target, answer);
  announce(`Hint: ${answer} goes in row ${rowOf(target) + 1}, column ${colOf(target) + 1}.`);
  play("flip");
  afterChange(false);
}

function afterChange(clearStatus = true): void {
  if (isSolved(values, solution)) return win();
  if (clearStatus) {
    const bad = conflicts(values);
    if (values[selected] && bad.has(selected)) announce(`${values[selected]} is already in this row, column or box.`, "lose");
    else announce(`${values.filter((v) => v === 0).length} cells to go.`);
  }
  persistGame();
  render();
  cells[selected]?.focus();
}

function win(): void {
  done = true;
  window.clearInterval(timer);
  stats.solved++;
  const key = bestKey(level);
  const newBest = hints === 0 && (!stats[key] || elapsed < stats[key]);
  if (newBest) stats[key] = elapsed;
  save("sudoku", stats);
  persistGame();
  showStats();
  render();
  const hintText = hints ? ` with ${hints} ${hints === 1 ? "hint" : "hints"}` : "";
  announce(`Solved in ${formatTime(elapsed)}${hintText}!${newBest ? " New best time." : ""}`, "win");
  play("win");
  $("again").focus();
}

function newPuzzle(l: Level = level): void {
  level = l;
  stats.level = l;
  save("sudoku", stats);
  const p = generate(l);
  puzzle = p.puzzle;
  solution = p.solution;
  values = [...puzzle];
  notes = Array(81).fill(0);
  elapsed = 0;
  hints = 0;
  done = false;
  history = [];
  selected = puzzle.indexOf(0);
  persistGame();
  renderLevels();
  render();
  startTimer();
  announce(`New ${LEVELS[l].label.toLowerCase()} puzzle. Fill every row, column and box with 1 to 9.`);
}

function resume(): boolean {
  const g = load("sudoku-game", EMPTY_GAME);
  if (!validBoard(g.puzzle) || !validBoard(g.solution) || !validBoard(g.values) || !isLevel(g.level)) return false;
  if (g.done) return false;
  if (!Array.isArray(g.notes) || g.notes.length !== 81) g.notes = Array(81).fill(0);
  puzzle = g.puzzle;
  solution = g.solution;
  values = g.values.map((v, i) => puzzle[i] || v);
  notes = g.notes.map((n) => (Number.isInteger(n) ? n : 0));
  level = g.level;
  elapsed = Math.max(0, Math.floor(g.elapsed));
  hints = Math.max(0, Math.floor(g.hints));
  selected = Math.max(0, values.indexOf(0));
  renderLevels();
  render();
  startTimer();
  announce(`Welcome back. Your ${LEVELS[level].label.toLowerCase()} puzzle is where you left it.`);
  return true;
}

/** Keyboard: arrows move, 1-9 place, Backspace erases, N notes, U undo, H hint. */
document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "z") {
    e.preventDefault();
    undo();
    return;
  }
  if (isTyping(e)) return;
  const move: Record<string, number> = { ArrowUp: -9, ArrowDown: 9, ArrowLeft: -1, ArrowRight: 1 };
  const d = move[e.key];
  if (d !== undefined) {
    e.preventDefault();
    let next = selected + d;
    if (d === -1 && colOf(selected) === 0) next = selected + 8;
    if (d === 1 && colOf(selected) === 8) next = selected - 8;
    if (next < 0) next += 81;
    if (next > 80) next -= 81;
    select(next);
    return;
  }
  if (/^[1-9]$/.test(e.key)) {
    e.preventDefault();
    input(Number(e.key));
    return;
  }
  const key = e.key.toLowerCase();
  if (key === "backspace" || key === "delete" || key === "0") {
    e.preventDefault();
    erase();
  } else if (key === "n") {
    notesMode = !notesMode;
    render();
  } else if (key === "u") {
    undo();
  } else if (key === "h") {
    hint();
  }
});

notesBtn.addEventListener("click", () => {
  notesMode = !notesMode;
  render();
});
$("erase").addEventListener("click", erase);
$("undo").addEventListener("click", undo);
$("hint").addEventListener("click", hint);
$("again").addEventListener("click", () => newPuzzle());
document.addEventListener("visibilitychange", () => {
  if (document.hidden) persistGame();
});
window.addEventListener("pagehide", persistGame);

initReset(() => {
  remove("sudoku");
  stats = { ...DEFAULT_STATS, level };
  save("sudoku", stats);
  showStats();
});

buildBoard();
showStats();
if (!resume()) newPuzzle(level);
