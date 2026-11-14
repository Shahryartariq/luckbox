/** Returns the element with this id, or throws so a broken page fails loudly in development. */
export function $<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id}`);
  return el as T;
}

export const prefersReducedMotion = (): boolean =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Waits, or resolves at once when the user prefers reduced motion. */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, prefersReducedMotion() ? 0 : ms));
}

/** True when a keyboard shortcut should be ignored because the user is typing or holding a modifier. */
export function isTyping(event: KeyboardEvent): boolean {
  const target = event.target as HTMLElement | null;
  return (
    event.metaKey || event.ctrlKey || event.altKey ||
    !!target?.closest("input, textarea, select, [contenteditable='true']")
  );
}

/** Registers single-key shortcuts. Keys are matched case-insensitively against event.key. */
export function shortcuts(map: Record<string, () => void>): void {
  const lower = Object.fromEntries(Object.entries(map).map(([k, fn]) => [k.toLowerCase(), fn]));
  document.addEventListener("keydown", (event) => {
    if (isTyping(event)) return;
    const fn = lower[event.key.toLowerCase()];
    if (!fn) return;
    // Let Enter/Space on a focused button keep their normal meaning.
    if ((event.key === "Enter" || event.key === " ") && (event.target as HTMLElement).closest("button")) return;
    event.preventDefault();
    fn();
  });
}

/** Restarts a CSS animation class on an element. */
export function pulse(el: HTMLElement, className: string): void {
  el.classList.remove(className);
  void el.offsetWidth;
  el.classList.add(className);
}

/**
 * Two-step confirm without a browser dialog: the first call arms the button and
 * changes its label, a second call within 3 seconds runs the action.
 * Returns a function to call on each click.
 */
export function confirmTwice(label: HTMLElement, armedText: string, action: () => void): () => void {
  let armed = false;
  let timer: number | undefined;
  const original = label.textContent ?? "";
  return () => {
    if (!armed) {
      armed = true;
      label.textContent = armedText;
      timer = window.setTimeout(() => {
        armed = false;
        label.textContent = original;
      }, 3000);
      return;
    }
    window.clearTimeout(timer);
    armed = false;
    label.textContent = original;
    action();
  };
}

/**
 * Guards actions that would throw away a game in progress. The first call explains
 * what will happen via `warn`; the same action again within 3 seconds goes ahead.
 */
export function makeAbandonGuard(inProgress: () => boolean, warn: (message: string) => void) {
  let armedKey: string | null = null;
  let timer: number | undefined;
  return (key: string, message: string, action: () => void): void => {
    if (!inProgress() || armedKey === key) {
      window.clearTimeout(timer);
      armedKey = null;
      action();
      return;
    }
    armedKey = key;
    warn(message);
    window.clearTimeout(timer);
    timer = window.setTimeout(() => (armedKey = null), 3000);
  };
}
