import "./home.css";
import { initSoundToggle } from "../shared/shell";
import { load } from "../shared/storage";

initSoundToggle();

const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;

/** One line per game for the ticket stubs, from what's saved in this browser. Null means not played. */
const lines: Record<string, () => string | null> = {
  blackjack: () => {
    const s = load("blackjack", { chips: 100, won: 0, lost: 0, pushes: 0 });
    return s.won + s.lost + s.pushes === 0 ? null : `${s.chips} chips, ${plural(s.won, "hand")} won`;
  },
  mines: () => {
    const s = load("mines", { points: 100, rounds: 0, bestMultiplier: 0 });
    if (s.rounds === 0) return null;
    return s.bestMultiplier ? `${s.points} points, best ${s.bestMultiplier.toFixed(2)}×` : `${s.points} points`;
  },
  "higher-or-lower": () => {
    const s = load("higher-or-lower", { bestStreak: 0, runs: 0, rightCalls: 0 });
    return s.runs === 0 && s.rightCalls === 0 ? null : `Best streak ${s.bestStreak}`;
  },
  pig: () => {
    const s = load("pig", { wins: 0, losses: 0 });
    return s.wins + s.losses === 0 ? null : `${plural(s.wins, "win")}, ${plural(s.losses, "loss", "losses")}`;
  },
  "rock-paper-scissors": () => {
    const s = load("rock-paper-scissors", { matchesWon: 0, matchesLost: 0 });
    return s.matchesWon + s.matchesLost === 0 ? null : `${s.matchesWon} of ${s.matchesWon + s.matchesLost} matches won`;
  },
  "number-guess": () => {
    const s = load("number-guess", { wins: 0, losses: 0, bestNormal: 0 });
    if (s.wins + s.losses === 0) return null;
    return s.bestNormal ? `Best on normal: ${plural(s.bestNormal, "try", "tries")}` : plural(s.wins, "win");
  },
};

document.querySelectorAll<HTMLElement>("[data-stat]").forEach((el) => {
  const line = lines[el.dataset.stat ?? ""]?.();
  if (line) {
    el.textContent = line;
    el.dataset.played = "true";
  }
});
