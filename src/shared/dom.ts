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
