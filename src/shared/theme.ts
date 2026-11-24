/**
 * Light / dark / system colour theme.
 * /theme.js applies the saved choice before first paint; this module keeps it in
 * sync afterwards: the topbar switch, other open tabs, and OS changes in "system" mode.
 */
export type ThemeChoice = "light" | "dark" | "system";

const KEY = "luckbox:theme";
const PAGE_COLOR = { light: "#2340d8", dark: "#0c1236" } as const;
const media = window.matchMedia("(prefers-color-scheme: dark)");
const listeners = new Set<(choice: ThemeChoice) => void>();

export function isThemeChoice(value: unknown): value is ThemeChoice {
  return value === "light" || value === "dark" || value === "system";
}

export function getThemeChoice(): ThemeChoice {
  try {
    const saved = localStorage.getItem(KEY);
    return saved === "light" || saved === "dark" ? saved : "system";
  } catch {
    return "system";
  }
}

/** The theme actually shown for a choice, given whether the OS prefers dark. */
export function resolveTheme(choice: ThemeChoice, systemDark: boolean): "light" | "dark" {
  if (choice === "system") return systemDark ? "dark" : "light";
  return choice;
}

function apply(choice: ThemeChoice): void {
  const theme = resolveTheme(choice, media.matches);
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", PAGE_COLOR[theme]);
  listeners.forEach((fn) => fn(choice));
}

export function setThemeChoice(choice: ThemeChoice): void {
  try {
    if (choice === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, choice);
  } catch {
    // Storage unavailable: the choice lasts for this page only.
  }
  apply(choice);
}

export function onThemeChange(fn: (choice: ThemeChoice) => void): void {
  listeners.add(fn);
}

let started = false;

/** Starts following OS changes and other tabs. Safe to call more than once. */
export function startTheme(): void {
  if (started) return;
  started = true;
  apply(getThemeChoice());
  media.addEventListener("change", () => {
    if (getThemeChoice() === "system") apply("system");
  });
  window.addEventListener("storage", (event) => {
    if (event.key === KEY || event.key === null) apply(getThemeChoice());
  });
}

/** Wires the Auto / Light / Dark switch in the topbar. */
export function initThemeSwitch(): void {
  startTheme();
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>("#theme-switch [data-theme-choice]"));
  const render = (choice: ThemeChoice): void => {
    for (const btn of buttons) btn.setAttribute("aria-pressed", String(btn.dataset.themeChoice === choice));
  };
  for (const btn of buttons) {
    btn.addEventListener("click", () => {
      const choice = btn.dataset.themeChoice;
      if (isThemeChoice(choice)) setThemeChoice(choice);
    });
  }
  render(getThemeChoice());
  onThemeChange(render);
}
