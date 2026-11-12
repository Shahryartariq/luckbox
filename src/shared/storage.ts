/**
 * Small wrapper around localStorage. Storage can be full, disabled or blocked
 * (private mode, embedded frames), so every call fails quietly and the game
 * keeps working without saved stats.
 */
const PREFIX = "luckbox:";

export function load<T extends object>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return { ...fallback };
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return { ...fallback };
    // Keep only known keys whose type matches the fallback, so old or edited data can't break a game.
    const out = { ...fallback };
    for (const k of Object.keys(fallback) as (keyof T)[]) {
      const value = (parsed as Record<keyof T, unknown>)[k];
      if (typeof value === typeof fallback[k] && (typeof value !== "number" || Number.isFinite(value))) {
        out[k] = value as T[keyof T];
      }
    }
    return out;
  } catch {
    return { ...fallback };
  }
}

export function save(key: string, value: object): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Storage unavailable: stats just won't persist.
  }
}

export function remove(key: string): void {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    // ignore
  }
}
