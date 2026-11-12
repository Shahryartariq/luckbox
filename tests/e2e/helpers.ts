import AxeBuilder from "@axe-core/playwright";
import { type Page, expect } from "@playwright/test";

export const GAME_PATHS = ["/blackjack/", "/mines/", "/higher-or-lower/", "/pig/", "/rock-paper-scissors/", "/number-guess/"];

/** Fails the test on any uncaught error or console error. */
export function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  return errors;
}

/** Turns animations off so tests don't wait on them. */
export async function fast(page: Page): Promise<void> {
  await page.emulateMedia({ reducedMotion: "reduce" });
}

export async function expectAccessible(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
}

export async function expectNoSideScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}
