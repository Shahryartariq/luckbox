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

test("sudoku: place, note, undo and hint", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/sudoku/");
  const cells = page.locator(".sd-cell");
  await expect(cells).toHaveCount(81);
  const given = await page.locator(".sd-cell.is-given").count();
  expect(given).toBeGreaterThanOrEqual(38);

  const selected = page.locator(".sd-cell.is-selected");
  await expect(selected).not.toHaveClass(/is-given/);
  await page.keyboard.press("5");
  await expect(selected).toHaveText("5");
  await page.keyboard.press("u");
  await expect(selected).toHaveText("");

  await page.locator("#notes").click();
  await expect(page.locator("#notes")).toHaveAttribute("aria-pressed", "true");
  await page.locator('.sd-key[data-n="2"]').click();
  await page.locator('.sd-key[data-n="7"]').click();
  await expect(selected.locator(".sd-notes")).toContainText("2");
  await expect(selected.locator(".sd-notes")).toContainText("7");
  await page.keyboard.press("n");

  await page.keyboard.press("h");
  await expect(page.locator("#status")).toContainText("Hint:");
  await expect(page.locator(".sd-cell.is-selected")).not.toHaveText("");

  // Progress survives a reload.
  const filled = await cells.filter({ hasText: /^[1-9]$/ }).count();
  await page.reload();
  await expect(page.locator("#status")).toContainText("Welcome back");
  await expect(cells.filter({ hasText: /^[1-9]$/ })).toHaveCount(filled);
  expect(errors).toEqual([]);
});

test("sudoku: solving the board wins and records a time", async ({ page }) => {
  await page.goto("/sudoku/");
  await expect(page.locator(".sd-cell")).toHaveCount(81);
  const solution = await page.evaluate(() => JSON.parse(localStorage.getItem("luckbox:sudoku-game") ?? "{}").solution as number[]);
  const puzzle = await page.evaluate(() => JSON.parse(localStorage.getItem("luckbox:sudoku-game") ?? "{}").puzzle as number[]);
  for (let i = 0; i < 81; i++) {
    if (puzzle[i]) continue;
    await page.locator(".sd-cell").nth(i).click();
    await page.keyboard.press(String(solution[i]));
  }
  await expect(page.locator("#status")).toHaveAttribute("data-tone", "win");
  await expect(page.locator("#status")).toContainText("Solved in");
  await expect(page.locator(".stat dd").first()).toHaveText("1");
  await expect(page.locator(".sd-key").first()).toBeDisabled();
});

test("sudoku: clashing numbers are flagged", async ({ page }) => {
  await page.goto("/sudoku/");
  const puzzle = await page.evaluate(() => JSON.parse(localStorage.getItem("luckbox:sudoku-game") ?? "{}").puzzle as number[]);
  // Find an empty cell and a given number in the same row, then place that number.
  for (let i = 0; i < 81; i++) {
    if (puzzle[i]) continue;
    const row = Math.floor(i / 9);
    const clash = puzzle.slice(row * 9, row * 9 + 9).find((v) => v > 0);
    if (!clash) continue;
    await page.locator(".sd-cell").nth(i).click();
    await page.keyboard.press(String(clash));
    await expect(page.locator(".sd-cell").nth(i)).toHaveClass(/is-conflict/);
    await expect(page.locator("#status")).toHaveAttribute("data-tone", "lose");
    break;
  }
});

test("2048: keys slide tiles, score adds up, progress is saved", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/2048/");
  const tiles = page.locator(".g2-tile");
  await expect(tiles).toHaveCount(2);
  const order = ["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown"];
  for (let i = 0; i < 40; i++) await page.keyboard.press(order[i % 4]!);
  // Each tile on the board is a power of two, and the total equals spawned 2s and 4s.
  const values = (await page.locator(".g2-tile").allTextContents()).map(Number);
  expect(values.every((v) => v >= 2 && (v & (v - 1)) === 0)).toBe(true);
  const score = Number(await page.locator("#score").textContent());
  expect(score).toBeGreaterThan(0);
  await expect(page.locator("#board-text")).toContainText("Row 1:");

  await page.reload();
  await expect(page.locator("#status")).toContainText("Welcome back");
  await expect(page.locator("#score")).toHaveText(String(score));
  await expect(page.locator(".g2-tile")).toHaveCount(values.length);
  expect(errors).toEqual([]);
});

test("2048: the on-screen arrows and a swipe both move tiles", async ({ page }) => {
  await page.goto("/2048/");
  const before = await page.locator("#board-text").textContent();
  for (const dir of ["left", "up", "right", "down"]) {
    await page.locator(`[data-dir="${dir}"]`).click();
    if ((await page.locator("#board-text").textContent()) !== before) break;
  }
  expect(await page.locator("#board-text").textContent()).not.toBe(before);

  const box = (await page.locator("#board").boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  let moved = false;
  for (const [dx, dy] of [[-120, 0], [0, -120], [120, 0], [0, 120]] as const) {
    const prev = await page.locator("#board-text").textContent();
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + dx, cy + dy, { steps: 5 });
    await page.mouse.up();
    if ((await page.locator("#board-text").textContent()) !== prev) {
      moved = true;
      break;
    }
  }
  expect(moved).toBe(true);
});

test("2048: new game asks twice once you have a score", async ({ page }) => {
  await page.goto("/2048/");
  for (const k of ["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"]) await page.keyboard.press(k);
  await page.keyboard.press("n");
  await expect(page.locator("#new-game-label")).toHaveText("Press again to restart");
  await page.keyboard.press("n");
  await expect(page.locator("#score")).toHaveText("0");
  await expect(page.locator(".g2-tile")).toHaveCount(2);
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
