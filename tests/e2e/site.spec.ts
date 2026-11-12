import { expect, test } from "@playwright/test";
import { GAME_PATHS, expectAccessible, expectNoSideScroll, fast, watchErrors } from "./helpers";

test("home page lists every game", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/");
  await expect(page).toHaveTitle(/luckbox/);
  const links = page.locator(".ticket__link");
  await expect(links).toHaveCount(6);
  for (const path of GAME_PATHS) await expect(page.locator(`.ticket__link[href="${path}"]`)).toBeVisible();
  await expectNoSideScroll(page);
  await expectAccessible(page);
  expect(errors).toEqual([]);
});

for (const path of GAME_PATHS) {
  test(`${path} loads cleanly`, async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(path);
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.locator("#status")).not.toBeEmpty();
    await expect(page.locator("#stats .stat").first()).toBeVisible();
    await expectNoSideScroll(page);
    await expectAccessible(page);
    expect(errors).toEqual([]);
  });
}

test("sound setting is remembered", async ({ page }) => {
  await page.goto("/mines/");
  const toggle = page.locator("#sound-toggle");
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await page.goto("/");
  await expect(page.locator("#sound-toggle")).toHaveAttribute("aria-pressed", "false");
});

test("stats show up on the home page ticket after playing", async ({ page }) => {
  await fast(page);
  await page.goto("/rock-paper-scissors/");
  for (let i = 0; i < 30 && (await page.locator("#again").isHidden()); i++) {
    await page.locator('[data-move="rock"]').click();
    await expect(page.locator("#log li")).toHaveCount(i + 1);
  }
  await expect(page.locator("#again")).toBeVisible();
  await page.goto("/");
  await expect(page.locator('[data-stat="rock-paper-scissors"]')).toHaveText(/matches won/);
  await expect(page.locator('[data-stat="sudoku"]')).toHaveText("Not played yet");
});

test("reset stats needs two clicks", async ({ page }) => {
  await fast(page);
  await page.goto("/higher-or-lower/");
  await page.keyboard.press("ArrowUp");
  await page.goto("/higher-or-lower/");
  const reset = page.locator("#reset-stats");
  await reset.click();
  await expect(reset).toHaveText("Click again to reset");
  await reset.click();
  await expect(reset).toHaveText("Stats reset");
});
