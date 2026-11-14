import { expect, test } from "@playwright/test";
import { fast, watchErrors } from "./helpers";

test.beforeEach(async ({ page }) => {
  await fast(page);
});

test("blackjack: a reload keeps the hand in play instead of cancelling it", async ({ page }) => {
  await page.goto("/blackjack/");
  for (let i = 0; i < 10 && !(await page.locator("#hit").isEnabled()); i++) {
    await page.locator("#deal").click();
    await expect(page.locator("#deal").or(page.locator("#hit")).first()).toBeVisible();
  }
  await expect(page.locator("#hit")).toBeEnabled();
  const cards = await page.locator("#player-hand .card").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
  await page.reload();
  await expect(page.locator("#status")).toContainText("Welcome back");
  await expect(page.locator("#hit")).toBeEnabled();
  await expect(page.locator("#deal")).toBeDisabled();
  expect(await page.locator("#player-hand .card").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")))).toEqual(cards);
});

test("blackjack: split a pair into two hands", async ({ page }) => {
  const errors = watchErrors(page);
  // A shoe that deals you 8, 8 against a dealer 10, 7 (cards are drawn from the end).
  const card = (rank: string, suit = "spades") => ({ rank, suit });
  const filler = Array.from({ length: 60 }, () => card("2"));
  const top = [card("8"), card("10", "hearts"), card("8", "clubs"), card("7"), card("3"), card("K")].reverse();
  await page.addInitScript((shoe) => {
    if (!sessionStorage.getItem("rigged")) {
      localStorage.setItem("luckbox:blackjack-table", JSON.stringify({ phase: "betting", hands: [], active: 0, dealer: [], shoe }));
      sessionStorage.setItem("rigged", "1");
    }
  }, [...filler, ...top]);
  await page.goto("/blackjack/");
  await page.locator("#deal").click();
  await expect(page.locator("#split")).toBeEnabled();
  await page.keyboard.press("p");
  await expect(page.locator(".bj-hand")).toHaveCount(2);
  await expect(page.locator('.bj-hand[data-active="true"] .bj-hand__label')).toHaveText("Hand 1: 11");
  await page.keyboard.press("s");
  await expect(page.locator('.bj-hand[data-active="true"] .bj-hand__label')).toHaveText("Hand 2: 18");
  await page.keyboard.press("s");
  await expect(page.locator("#status")).toHaveAttribute("data-tone", /win|lose|push/);
  await expect(page.locator("#status")).toContainText("Hand 1");
  await expect(page.locator("#status")).toContainText("Hand 2");
  expect(errors).toEqual([]);
});

test("mines: a round with tiles flipped survives a reload and can still cash out", async ({ page }) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem("seeded")) {
      localStorage.setItem("luckbox:mines", JSON.stringify({ points: 90, mines: 3, rounds: 1, cashOuts: 0, bestMultiplier: 0, mostPoints: 100 }));
      localStorage.setItem("luckbox:mines-round", JSON.stringify({ mines: 3, stake: 10, mineAt: [0, 1, 2], revealed: [12], status: "playing", hit: null }));
      sessionStorage.setItem("seeded", "1");
    }
  });
  await page.goto("/mines/");
  await expect(page.locator("#status")).toContainText("Welcome back");
  await expect(page.locator('.tile[data-state="gem"]')).toHaveCount(1);
  await expect(page.locator("#cash-out")).toBeEnabled();
  await page.keyboard.press("c");
  // 10 points × 1.13 with 3 mines after one safe tile = 11.
  await expect(page.locator(".stat dd").first()).toHaveText("101");
});

test("higher or lower: a reload keeps the streak and the card", async ({ page }) => {
  await page.goto("/higher-or-lower/");
  // Play the better side until there is a live streak (starting a new run if one ends).
  for (let i = 0; i < 60; i++) {
    if (await page.locator("#again").isVisible()) await page.keyboard.press("n");
    const streakNow = Number(await page.locator(".stat dd").first().textContent());
    if (streakNow >= 1 && (await page.locator("#again").isHidden())) break;
    const h = parseInt((await page.locator("#odds-higher").textContent()) ?? "0", 10);
    const l = parseInt((await page.locator("#odds-lower").textContent()) ?? "0", 10);
    await page.keyboard.press(h >= l ? "ArrowUp" : "ArrowDown");
  }
  await expect(page.locator("#again")).toBeHidden();
  const card = await page.locator("#current-card .card").getAttribute("aria-label");
  const streak = await page.locator(".stat dd").first().textContent();
  expect(Number(streak)).toBeGreaterThanOrEqual(1);
  await page.reload();
  await expect(page.locator("#status")).toContainText("Welcome back");
  await expect(page.locator("#current-card .card")).toHaveAttribute("aria-label", card!);
  await expect(page.locator(".stat dd").first()).toHaveText(streak!);
});

test("rock paper scissors: a reload keeps the match score", async ({ page }) => {
  await page.goto("/rock-paper-scissors/");
  await page.keyboard.press("r");
  await expect(page.locator("#log li")).toHaveCount(1);
  const score = [await page.locator("#you-score").textContent(), await page.locator("#cpu-score").textContent()];
  await page.reload();
  expect([await page.locator("#you-score").textContent(), await page.locator("#cpu-score").textContent()]).toEqual(score);
  await expect(page.locator("#status")).toContainText("Welcome back");
});

test("number guess: odd input is refused, tries survive a reload, giving up asks first", async ({ page }) => {
  await page.goto("/number-guess/");
  const input = page.locator("#guess-input");
  await input.fill("1e1");
  await input.press("Enter");
  await expect(page.locator("#input-error")).toHaveText("Enter a whole number from 1 to 100.");
  await expect(page.locator("#tries-left")).toHaveText("7");

  await input.fill("50");
  await input.press("Enter");
  test.skip((await page.locator("#status").getAttribute("data-tone")) === "win", "Guessed it first time");
  await page.reload();
  await expect(page.locator("#tries-left")).toHaveText("6");
  await expect(page.locator("#history li")).toHaveCount(1);

  await page.locator("#again").click();
  await expect(page.locator("#status")).toContainText("Press again to give up");
  await expect(page.locator("#tries-left")).toHaveText("6");
  await page.locator("#again").click();
  await expect(page.locator("#tries-left")).toHaveText("7");
  await expect(page.locator(".stat dd").nth(1)).toHaveText("1");
});

test("sudoku: starting over asks first, and given cells explain why they can't change", async ({ page }) => {
  await page.goto("/sudoku/");
  const game = await page.evaluate(() => JSON.parse(localStorage.getItem("luckbox:sudoku-game") ?? "{}"));
  const empty = (game.puzzle as number[]).indexOf(0);
  await page.locator(".sd-cell").nth(empty).click();
  await page.keyboard.press("5");
  await page.locator("#again").click();
  await expect(page.locator("#status")).toContainText("Press New puzzle again");
  await expect(page.locator(".sd-cell").nth(empty)).toHaveText("5");
  await page.locator("#again").click();
  await expect(page.locator("#status")).toContainText("New easy puzzle");

  const fresh = await page.evaluate(() => JSON.parse(localStorage.getItem("luckbox:sudoku-game") ?? "{}"));
  const given = (fresh.puzzle as number[]).findIndex((v) => v > 0);
  await page.locator(".sd-cell").nth(given).click();
  await page.keyboard.press("Backspace");
  await expect(page.locator("#status")).toContainText("can't be erased");
});
