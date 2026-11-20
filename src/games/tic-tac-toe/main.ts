import "./style.css";
import { $, isTyping, makeAbandonGuard, wait } from "../../shared/dom";
import { load, loadRaw, remove, save } from "../../shared/storage";
import { announce, initGamePage, initReset, renderStats } from "../../shared/shell";
import { play } from "../../shared/sound";
import { LEVELS, type Level, type Mark, TicTacToe } from "./logic";

initGamePage("tic-tac-toe");

const DEFAULT_STATS = { wins: 0, losses: 0, draws: 0, streak: 0, bestStreak: 0, level: "medium", nextStarter: "X" };
let stats = load("tic-tac-toe", DEFAULT_STATS);
const isLevel = (x: string): x is Level => x in LEVELS;
const isMark = (x: string): x is Mark => x === "X" || x === "O";

const boardEl = $("board");
const levelsEl = $("levels");
const turnEl = $("turn");
const cells: HTMLButtonElement[] = [];

let game = new TicTacToe(isLevel(stats.level) ? stats.level : "medium");
let focusIndex = 4;
let thinking = false;

function showStats(): void {
  renderStats([
    { label: "Wins", value: stats.wins },
    { label: "Losses", value: stats.losses },
    { label: "Draws", value: stats.draws },
    { label: "Best streak", value: stats.bestStreak },
  ]);
}

const persistGame = (): void => (game.over ? remove("tic-tac-toe-game") : save("tic-tac-toe-game", game.save()));
const movesMade = (): number => game.board.filter(Boolean).length;
/** You have a game against the computer under way: leaving it would dodge a result. */
const inProgress = (): boolean => !game.over && movesMade() > 0;
const guard = makeAbandonGuard(inProgress, (m) => announce(m, "lose"));

function buildBoard(): void {
  for (let r = 0; r < 3; r++) {
    const row = document.createElement("div");
    row.setAttribute("role", "row");
    row.className = "ttt-row";
    for (let c = 0; c < 3; c++) {
      const i = r * 3 + c;
      const cell = document.createElement("div");
      cell.setAttribute("role", "gridcell");
      cell.className = "ttt-gridcell";
      const b = document.createElement("button");
      b.type = "button";
      b.className = "ttt-cell";
      b.dataset.index = String(i);
      b.addEventListener("click", () => void place(i));
      cell.append(b);
      row.append(cell);
      cells.push(b);
    }
    boardEl.append(row);
  }
}

function renderLevels(): void {
  levelsEl.replaceChildren(
    ...(Object.keys(LEVELS) as Level[]).map((l) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = LEVELS[l];
      b.setAttribute("aria-pressed", String(l === game.level));
      b.addEventListener("click", () => {
        if (l === game.level) return;
        guard(`level-${l}`, giveUpMessage(`switch to ${LEVELS[l].toLowerCase()}`), () => giveUpAnd(() => newGame(l)));
      });
      return b;
    }),
  );
}

function giveUpMessage(what: string): string {
  return game.vsCpu
    ? `This game isn't finished. Press again to give up (it counts as a loss) and ${what}.`
    : `This game isn't finished. Press again to ${what}.`;
}

function giveUpAnd(next: () => void): void {
  if (game.vsCpu && inProgress()) {
    stats.losses++;
    stats.streak = 0;
    save("tic-tac-toe", stats);
    showStats();
  }
  next();
}

function render(): void {
  const result = game.result;
  const winLine = new Set(result.line ?? []);
  cells.forEach((b, i) => {
    const mark = game.board[i];
    b.dataset.mark = mark ?? "";
    b.dataset.win = String(winLine.has(i));
    b.disabled = !!mark || game.over || thinking;
    b.tabIndex = i === focusIndex ? 0 : -1;
    const row = Math.floor(i / 3) + 1;
    const col = (i % 3) + 1;
    b.setAttribute("aria-label", `Row ${row}, column ${col}, ${mark ?? "empty"}${winLine.has(i) ? ", winning line" : ""}`);
  });
  boardEl.dataset.over = String(game.over);
  if (game.over) turnEl.textContent = "";
  else if (!game.vsCpu) turnEl.textContent = `${game.turn} to play`;
  else turnEl.textContent = game.turn === "X" ? "Your turn (X)" : "Computer is thinking…";
  turnEl.dataset.mark = game.turn;
}

function finish(): void {
  const result = game.result;
  if (!game.vsCpu) {
    if (result.status === "won") announce(`${result.mark} wins!`, "win");
    else announce("It's a draw.", "push");
    play(result.status === "won" ? "win" : "push");
  } else if (result.status === "won" && result.mark === "X") {
    stats.wins++;
    stats.streak++;
    stats.bestStreak = Math.max(stats.bestStreak, stats.streak);
    announce(`You win on ${LEVELS[game.level].toLowerCase()}!`, "win");
    play("win");
  } else if (result.status === "won") {
    stats.losses++;
    stats.streak = 0;
    announce("The computer wins this one.", "lose");
    play("lose");
  } else {
    stats.draws++;
    announce(game.level === "hard" ? "A draw. That's the best anyone can do on unbeatable." : "It's a draw.", "push");
    play("push");
  }
  save("tic-tac-toe", stats);
  persistGame();
  showStats();
  render();
  $("again").focus();
}

async function cpuTurn(): Promise<void> {
  if (!game.vsCpu || game.turn !== "O" || game.over) return;
  thinking = true;
  render();
  await wait(450);
  const i = game.cpuTurn();
  thinking = false;
  play("flip");
  persistGame();
  const row = Math.floor(i / 3) + 1;
  const col = (i % 3) + 1;
  if (game.over) return finish();
  announce(`Computer played row ${row}, column ${col}. Your turn.`);
  render();
  cells[focusIndex]?.focus();
}

async function place(i: number): Promise<void> {
  if (thinking || !game.canPlay(i) || (game.vsCpu && game.turn !== "X")) return;
  const mark = game.turn;
  game.play(i);
  focusIndex = i;
  play("tap");
  persistGame();
  if (game.over) return finish();
  if (game.vsCpu) return cpuTurn();
  announce(`${mark} played. ${game.turn} to play.`);
  render();
}

function newGame(level: Level = game.level): void {
  // Against the computer, who starts switches each game.
  const starter: Mark = level === "duo" ? "X" : isMark(stats.nextStarter) ? stats.nextStarter : "X";
  if (level !== "duo") stats.nextStarter = starter === "X" ? "O" : "X";
  stats.level = level;
  save("tic-tac-toe", stats);
  game = new TicTacToe(level, starter);
  thinking = false;
  focusIndex = 4;
  persistGame();
  renderLevels();
  render();
  if (level === "duo") announce("Two players. X goes first.");
  else if (starter === "X") announce(`New game on ${LEVELS[level].toLowerCase()}. You go first.`);
  else {
    announce(`New game on ${LEVELS[level].toLowerCase()}. The computer goes first.`);
    void cpuTurn();
  }
}

/** Keyboard: 1 to 9 place a mark, arrows move between cells, N starts a new game. */
document.addEventListener("keydown", (e) => {
  if (isTyping(e)) return;
  if (/^[1-9]$/.test(e.key)) {
    e.preventDefault();
    void place(Number(e.key) - 1);
    return;
  }
  const move: Record<string, number> = { ArrowUp: -3, ArrowDown: 3, ArrowLeft: -1, ArrowRight: 1 };
  const d = move[e.key];
  if (d !== undefined && (e.target as HTMLElement).closest(".ttt-board")) {
    e.preventDefault();
    const next = focusIndex + d;
    if (next < 0 || next > 8 || ((d === 1 || d === -1) && Math.floor(next / 3) !== Math.floor(focusIndex / 3))) return;
    focusIndex = next;
    render();
    cells[focusIndex]?.focus();
    return;
  }
  if (e.key.toLowerCase() === "n") newGameGuarded();
});

const newGameGuarded = (): void => guard("new", giveUpMessage("start a new game"), () => giveUpAnd(() => newGame()));
$("again").addEventListener("click", newGameGuarded);

initReset(() => {
  remove("tic-tac-toe");
  stats = { ...DEFAULT_STATS, level: game.level };
  save("tic-tac-toe", stats);
  showStats();
});

buildBoard();
showStats();
const resumed = TicTacToe.restore(loadRaw("tic-tac-toe-game"));
if (resumed && !resumed.over && resumed.board.some(Boolean)) {
  game = resumed;
  renderLevels();
  render();
  announce(game.vsCpu ? "Welcome back. Your game is where you left it." : `Welcome back. ${game.turn} to play.`);
  if (game.vsCpu && game.turn === "O") void cpuTurn();
} else {
  newGame(game.level);
}
