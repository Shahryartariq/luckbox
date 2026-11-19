import { expect, test } from "@playwright/test";
import { fast, watchErrors } from "./helpers";

test.beforeEach(async ({ page }) => {
  await fast(page);
});

async function pickLevel(page: import("@playwright/test").Page, name: string): Promise<void> {
  const btn = page.locator("#levels button", { hasText: name });
  if ((await btn.getAttribute("aria-pressed")) === "true") return;
  await btn.click();
  if ((await btn.getAttribute("aria-pressed")) !== "true") await btn.click();
  await expect(btn).toHaveAttribute("aria-pressed", "true");
}

test("two players: X wins with three in a row", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/tic-tac-toe/");
  await pickLevel(page, "Two players");
  for (const k of ["1", "4", "2", "5", "3"]) await page.keyboard.press(k);
  await expect(page.locator("#status")).toHaveText("X wins!");
  await expect(page.locator('.ttt-cell[data-win="true"]')).toHaveCount(3);
  await expect(page.locator(".ttt-cell").nth(8)).toBeDisabled();
  expect(errors).toEqual([]);
});

test("unbeatable: you can't win, whatever you try", async ({ page }) => {
  await page.goto("/tic-tac-toe/");
  await pickLevel(page, "Unbeatable");
  for (let game = 0; game < 2; game++) {
    const board = page.locator("#board");
    for (let i = 0; i < 9 && (await board.getAttribute("data-over")) !== "true"; i++) {
      // Wait for the computer to finish its move, then take the first open cell.
      await expect(page.locator("#turn")).not.toHaveText("Computer is thinking…");
      if ((await board.getAttribute("data-over")) === "true") break;
      await page.locator(".ttt-cell:not([disabled])").first().click();
    }
    await expect(board).toHaveAttribute("data-over", "true");
    await expect(page.locator("#status")).toHaveAttribute("data-tone", /lose|push/);
    await expect(page.locator("#status")).not.toContainText("You win");
    await page.keyboard.press("n");
  }
  await expect(page.locator(".stat dd").first()).toHaveText("0");
});

test("a game in progress survives a reload, and giving up asks first", async ({ page }) => {
  await page.goto("/tic-tac-toe/");
  await pickLevel(page, "Easy");
  await expect(page.locator("#turn")).toHaveText("Your turn (X)");
  const open = page.locator(".ttt-cell:not([disabled])");
  await open.first().click();
  await expect(page.locator("#turn")).toHaveText("Your turn (X)");
  const marks = await page.locator(".ttt-cell").evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.mark));
  await page.reload();
  await expect(page.locator("#status")).toContainText("Welcome back");
  expect(await page.locator(".ttt-cell").evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.mark))).toEqual(marks);

  await page.locator("#again").click();
  await expect(page.locator("#status")).toContainText("Press again to give up");
  await page.locator("#again").click();
  await expect(page.locator(".stat dd").nth(1)).toHaveText("1");
});

test("arrow keys move between cells", async ({ page }) => {
  await page.goto("/tic-tac-toe/");
  await pickLevel(page, "Two players");
  await page.locator(".ttt-cell").nth(4).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".ttt-cell").nth(5)).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(page.locator(".ttt-cell").nth(8)).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator(".ttt-cell").nth(8)).toHaveAttribute("data-mark", "X");
});
