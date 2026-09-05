import { expect, test } from './fixtures';
import { getCurrentMap, getPlayerState, getSave, menuActivate, openGame, startNewGame, teleport, waitForMainMenu } from './helpers/game';

/**
 * Things a player does that no feature test covers: switching tabs mid-walk, resizing the window mid-game,
 * and starting a new game over a finished one.
 */

const MAP_LOAD = { timeout: 30_000 };

test('losing window focus while a key is held does not leave the hero walking', async ({ page, errorWatcher }) => {
  void errorWatcher;
  await openGame(page);
  await startNewGame(page);
  const start = await getPlayerState(page);

  await page.keyboard.down('KeyD');
  await expect.poll(async () => (await getPlayerState(page)).x).toBeGreaterThan(start.x + 8);

  // Alt-Tab: the browser fires blur and never sends the keyup for the key that was held.
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.waitForTimeout(300);
  const stopped = await getPlayerState(page);
  await page.waitForTimeout(500);
  const later = await getPlayerState(page);
  expect(Math.abs(later.x - stopped.x)).toBeLessThan(1);
  await page.keyboard.up('KeyD');

  // Input recovers: the next press moves the hero again.
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.keyboard.down('KeyD');
  try {
    await expect.poll(async () => (await getPlayerState(page)).x).toBeGreaterThan(later.x + 8);
  } finally {
    await page.keyboard.up('KeyD');
  }
});

test('resizing the window mid-game keeps the display sane and the hero controllable', async ({ page, errorWatcher }) => {
  void errorWatcher;
  await openGame(page);
  await startNewGame(page);

  for (const [width, height] of [
    [1024, 600],
    [1920, 1080],
    [1366, 768],
  ] as const) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(400);
    const display = await page.evaluate(() => window.__GAME_TEST__?.getDisplay() ?? null);
    expect(display).not.toBeNull();
    expect(display?.zoom ?? 0).toBeGreaterThanOrEqual(2);
    expect((display?.width ?? 0) * (display?.zoom ?? 0)).toBeLessThanOrEqual(display?.canvasWidth ?? 0);
    expect(display?.canvasWidth).toBe(width);
    expect(display?.canvasHeight).toBe(height);

    const before = await getPlayerState(page);
    await page.keyboard.down('KeyD');
    try {
      await expect.poll(async () => (await getPlayerState(page)).x).toBeGreaterThan(before.x + 6);
    } finally {
      await page.keyboard.up('KeyD');
    }
    await page.waitForTimeout(150);
  }
});

test('New Game over an existing save starts clean: coins, level and the grove chest all reset', async ({ page, errorWatcher }) => {
  void errorWatcher;
  test.setTimeout(90_000);
  await openGame(page);
  await startNewGame(page);

  // Make the save distinctly non-fresh: open the grove chest for coins.
  await teleport(page, 568, 112);
  await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(150);
  await page.keyboard.press('KeyE');
  await expect.poll(async () => (await getSave(page)).player.coins).toBeGreaterThan(0);
  const dirty = await getSave(page);

  // Save & Quit, then New Game through its warning.
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  await menuActivate(page, 'Save & Quit');
  await waitForMainMenu(page);
  await page.waitForTimeout(700);
  await menuActivate(page, 'New Game');
  await page.waitForTimeout(300);
  await menuActivate(page, 'Confirm');
  await expect.poll(() => getCurrentMap(page), MAP_LOAD).toBe('village');
  await page.waitForTimeout(400);

  const fresh = await getSave(page);
  expect(fresh.player.coins).toBe(0);
  expect(fresh.player.level).toBe(1);
  expect(fresh.player.coins).toBeLessThan(dirty.player.coins);

  // The chest is closed again in the new world.
  await teleport(page, 568, 112);
  await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(150);
  await page.keyboard.press('KeyE');
  await expect.poll(async () => (await getSave(page)).player.coins).toBeGreaterThan(0);
});
