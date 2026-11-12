import "@fontsource/bungee/400.css";
import "@fontsource/atkinson-hyperlegible-next/400.css";
import "@fontsource/atkinson-hyperlegible-next/700.css";
import "../styles/base.css";
import { $ } from "./dom";
import { getGame } from "./games";
import { isSoundOn, onSoundChange, setSound } from "./sound";

/** Shared setup for every game page. */
export function initGamePage(slug: string): void {
  const game = getGame(slug);
  document.body.dataset.color = game.color;
  initSoundToggle();
}

export function initSoundToggle(): void {
  const soundBtn = $<HTMLButtonElement>("sound-toggle");
  const render = (on: boolean): void => {
    soundBtn.setAttribute("aria-pressed", String(on));
    soundBtn.textContent = on ? "Sound on" : "Sound off";
  };
  render(isSoundOn());
  soundBtn.addEventListener("click", () => setSound(!isSoundOn()));
  onSoundChange(render);
}

export interface StatItem {
  label: string;
  value: string | number;
}

/** Renders the stats stub on the side of the game ticket. */
export function renderStats(items: StatItem[]): void {
  const list = $("stats");
  list.replaceChildren(
    ...items.map(({ label, value }) => {
      const wrap = document.createElement("div");
      wrap.className = "stat";
      const dt = document.createElement("dt");
      dt.textContent = label;
      const dd = document.createElement("dd");
      dd.textContent = String(value);
      if (typeof value === "string" && !/^[\d.,×]+$/.test(value)) dd.className = "stat__text";
      wrap.append(dt, dd);
      return wrap;
    }),
  );
}

/** Wires the "Reset stats" button with a two-step confirm (no browser dialog). */
export function initReset(onReset: () => void): void {
  const btn = $<HTMLButtonElement>("reset-stats");
  let armed = false;
  let timer: number | undefined;
  btn.addEventListener("click", () => {
    if (!armed) {
      armed = true;
      btn.textContent = "Click again to reset";
      timer = window.setTimeout(() => {
        armed = false;
        btn.textContent = "Reset stats";
      }, 3000);
      return;
    }
    window.clearTimeout(timer);
    armed = false;
    btn.textContent = "Stats reset";
    onReset();
    window.setTimeout(() => (btn.textContent = "Reset stats"), 1500);
  });
}

/** Announces a result to screen readers and shows it in the status line. */
export function announce(text: string, tone: "win" | "lose" | "push" | "info" = "info"): void {
  const el = $("status");
  el.textContent = text;
  el.dataset.tone = tone;
}
