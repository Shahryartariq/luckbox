import { expect, test } from "@playwright/test";
import { GAME_PATHS, expectAccessible, expectNoSideScroll, fast, watchErrors } from "./helpers";

const theme = (page: import("@playwright/test").Page) => page.evaluate(() => document.documentElement.dataset.theme);
const button = (page: import("@playwright/test").Page, name: string) =>
  page.getByRole("group", { name: "Colour theme" }).getByRole("button", { name });

test("follows the system setting by default", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  expect(await theme(page)).toBe("dark");
  await expect(button(page, "Auto theme")).toHaveAttribute("aria-pressed", "true");

  await page.emulateMedia({ colorScheme: "light" });
  await expect.poll(() => theme(page)).toBe("light");
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#2340d8");
});

test("theme is set before the page paints", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("luckbox:theme", "dark"));
  // Record the theme as soon as the body exists, before any module script runs.
  await page.addInitScript(() => {
    const w = window as unknown as { firstTheme: string | undefined };
    new MutationObserver((_, observer) => {
      if (document.body) {
        w.firstTheme = document.documentElement.dataset.theme;
        observer.disconnect();
      }
    }).observe(document, { childList: true, subtree: true });
  });
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/blackjack/");
  expect(await page.evaluate(() => (window as unknown as { firstTheme: string | undefined }).firstTheme)).toBe("dark");
});

test("a chosen theme is remembered and shared across pages and tabs", async ({ page, context }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await button(page, "Dark theme").click();
  expect(await theme(page)).toBe("dark");
  await expect(button(page, "Dark theme")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#0c1236");

  // Survives navigation and ignores the system setting.
  await page.goto("/mines/");
  expect(await theme(page)).toBe("dark");
  await expect(button(page, "Dark theme")).toHaveAttribute("aria-pressed", "true");

  // Another open tab follows along.
  const other = await context.newPage();
  await other.goto("/sudoku/");
  await button(page, "Light theme").click();
  await expect.poll(() => theme(other)).toBe("light");
  await expect(button(other, "Light theme")).toHaveAttribute("aria-pressed", "true");

  // Back to Auto clears the saved choice.
  await button(page, "Auto theme").click();
  expect(await page.evaluate(() => localStorage.getItem("luckbox:theme"))).toBeNull();
});

test("ignores a broken saved value", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("luckbox:theme", "purple"));
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  expect(await theme(page)).toBe("light");
  await expect(button(page, "Auto theme")).toHaveAttribute("aria-pressed", "true");
});

test.describe("dark mode", () => {
  test.beforeEach(async ({ page }) => {
    await fast(page);
    await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  });

  for (const path of ["/", ...GAME_PATHS]) {
    test(`${path} passes accessibility checks`, async ({ page }) => {
      const errors = watchErrors(page);
      await page.goto(path);
      expect(await theme(page)).toBe("dark");
      await expectAccessible(page);
      await expectNoSideScroll(page);
      expect(errors).toEqual([]);
    });
  }

  test("404 page uses the dark background", async ({ page }) => {
    await page.goto("/no-such-page/");
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).toBe("rgb(12, 18, 54)");
    await expectAccessible(page);
  });
});
