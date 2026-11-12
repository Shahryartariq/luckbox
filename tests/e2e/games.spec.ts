import { expect, test } from "@playwright/test";
import { fast, watchErrors } from "./helpers";

test.beforeEach(async ({ page }) => {
  await fast(page);
});

test("blackjack: deal and play hands to the end", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/blackjack/");
  const chips = page.locator("#chips");
  await expect(chips).toHaveText("100");
  for (let hand = 0; hand < 5; hand++) {
    await page.locator("#deal").click();
    await expect(page.locator("#player-hand .card")).toHaveCount(2);
    // Hit until the buttons lock (bust, 21 or dealer's turn), standing at 17+.
    for (let i = 0; i < 8 && (await page.locator("#hit").isEnabled()); i++) {
      const total = Number((await page.locator("#player-total").textContent())?.match(/\d+$/)?.[0] ?? 0);
      await page.locator(total >= 17 ? "#stand" : "#hit").click();
    }
    await expect(page.locator("#status")).toHaveAttribute("data-tone", /win|lose|push/);
    await expect(page.locator("#dealer-hand .card--back")).toHaveCount(0);
  }
  const won = Number(await page.locator(".stat dd").nth(2).textContent());
  const lost = Number(await page.locator(".stat dd").nth(3).textContent());
  const pushes = Number(await page.locator(".stat dd").nth(4).textContent());
  expect(won + lost + pushes).toBe(5);
  await page.reload();
  await expect(page.locator("#chips")).not.toHaveText("");
  expect(errors).toEqual([]);
});

test("blackjack: dealer's second card stays hidden during your turn", async ({ page }) => {
  await page.goto("/blackjack/");
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press("n");
    if (await page.locator("#hit").isEnabled()) break;
    await expect(page.locator("#deal")).toBeEnabled();
  }
  await expect(page.locator("#hit")).toBeEnabled();
  await expect(page.locator("#dealer-hand .card--back")).toHaveCount(1);
  await page.keyboard.press("s");
  await expect(page.locator("#dealer-hand .card--back")).toHaveCount(0);
});

test("mines: flip, then cash out or bust", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/mines/");
  await page.locator('#mine-options button[aria-label="3 mines"]').click();
  const tiles = page.locator(".tile");
  await expect(tiles).toHaveCount(25);
  await tiles.nth(0).click();
  const tone = await page.locator("#status").getAttribute("data-tone");
  if (tone === "lose") {
    await expect(page.locator('.tile[data-state="boom"]')).toHaveCount(1);
    await expect(page.locator('.tile[data-state="mine"]')).toHaveCount(2);
  } else {
    await expect(page.locator('.tile[data-state="gem"]')).toHaveCount(1);
    await expect(page.locator("#cash-out")).toBeEnabled();
    await page.keyboard.press("c");
    await expect(page.locator("#status")).toHaveAttribute("data-tone", "win");
    // 10 points staked, 1 safe tile with 3 mines pays floor(10 × 1.13) = 11.
    await expect(page.locator(".stat dd").first()).toHaveText("101");
  }
  await page.keyboard.press("n");
  await expect(page.locator('.tile[data-state="hidden"]')).toHaveCount(25);
  expect(errors).toEqual([]);
});

test("higher or lower: play a run until it ends", async ({ page }) => {
  await page.goto("/higher-or-lower/");
  for (let i = 0; i < 200 && (await page.locator("#again").isHidden()); i++) {
    const higher = parseInt((await page.locator("#odds-higher").textContent()) ?? "0", 10);
    const lower = parseInt((await page.locator("#odds-lower").textContent()) ?? "0", 10);
    await page.keyboard.press(higher >= lower ? "ArrowUp" : "ArrowDown");
  }
  await expect(page.locator("#again")).toBeVisible();
  await expect(page.locator("#higher")).toBeDisabled();
  await expect(page.locator("#status")).toContainText("Wrong call");
  await page.keyboard.press("n");
  await expect(page.locator("#higher")).toBeEnabled();
});

test("pig: roll, bank and let the computer play", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/pig/");
  await page.locator("#roll").click();
  await expect(page.locator("#die .pip").first()).toBeVisible();
  if (await page.locator("#bank").isEnabled()) {
    await page.locator("#bank").click();
  }
  // The computer plays, then hands the turn back (or wins).
  await expect(page.locator("#roll").or(page.locator("#again")).first()).toBeEnabled({ timeout: 30_000 });
  const total = Number(await page.locator("#you-score").textContent()) + Number(await page.locator("#cpu-score").textContent());
  expect(total).toBeGreaterThanOrEqual(0);
  expect(errors).toEqual([]);
});

test("rock paper scissors: a match ends at three wins", async ({ page }) => {
  await page.goto("/rock-paper-scissors/");
  for (let i = 0; i < 40 && (await page.locator("#again").isHidden()); i++) {
    await page.keyboard.press(["r", "p", "s"][i % 3]!);
    await expect(page.locator("#log li")).toHaveCount(i + 1);
  }
  const you = Number(await page.locator("#you-score").textContent());
  const cpu = Number(await page.locator("#cpu-score").textContent());
  expect(Math.max(you, cpu)).toBe(3);
  await expect(page.locator("#status")).toContainText("match");
});

test("number guess: binary search always wins on normal", async ({ page }) => {
  await page.goto("/number-guess/");
  const input = page.locator("#guess-input");
  for (let i = 0; i < 7; i++) {
    const text = (await page.locator("#possible").textContent()) ?? "";
    const [low, high = low] = text.split(" to ").map(Number) as [number, number?];
    await input.fill(String(Math.floor((low + high) / 2)));
    await input.press("Enter");
    if ((await page.locator("#status").getAttribute("data-tone")) === "win") break;
  }
  await expect(page.locator("#status")).toHaveAttribute("data-tone", "win");
  await expect(page.locator("#guess-input")).toBeDisabled();
});

test("number guess: bad input explains itself and costs nothing", async ({ page }) => {
  await page.goto("/number-guess/");
  await page.locator("#guess-input").fill("500");
  await page.locator("#guess-input").press("Enter");
  await expect(page.locator("#input-error")).toHaveText("Pick a number from 1 to 100.");
  await expect(page.locator("#tries-left")).toHaveText("7");
});
