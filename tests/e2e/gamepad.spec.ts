import { expect, test } from './fixtures';
import type { Page } from './fixtures';
import { getCurrentMap, getPlayerState, openGame, startNewGame, waitForMainMenu } from './helpers/game';

/**
 * Synthetic-gamepad coverage. Chromium exposes no real controller in CI, so a mutable fake gamepad is
 * installed over navigator.getGamepads; Phaser polls that every frame, so mutating the fake's buttons and axes
 * drives the real input path. Standard mapping button indices: A=0, B=1, X=2, Y=3, LB=4, View=8, Menu=9,
 * D-pad up/down/left/right = 12/13/14/15; left stick = axes 0/1.
 *
 * Glyph text (E vs A/X) is unit-tested in input-bindings.test.ts; this checks the pad actually navigates and acts.
 */

const MAP_LOAD = { timeout: 30_000 };

async function installGamepad(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const buttons = Array.from({ length: 17 }, () => ({ value: 0, pressed: false, touched: false }));
    const pad = {
      id: 'Emberfall Synthetic Pad (standard)',
      index: 0,
      connected: true,
      mapping: 'standard',
      axes: [0, 0, 0, 0],
      buttons,
      timestamp: performance.now(),
    };
    // Phaser reads navigator.getGamepads() every frame and refreshes pad state from the live object.
    (navigator as unknown as { getGamepads: () => unknown[] }).getGamepads = () => [pad];
    const stamp = (): void => {
      pad.timestamp = performance.now();
    };
    (window as unknown as { __PAD__: unknown }).__PAD__ = {
      press(i: number) {
        const b = buttons[i];
        if (!b) return;
        b.pressed = true;
        b.value = 1;
        stamp();
      },
      release(i: number) {
        const b = buttons[i];
        if (!b) return;
        b.pressed = false;
        b.value = 0;
        stamp();
      },
      axis(i: number, v: number) {
        pad.axes[i] = v;
        stamp();
      },
    };
    try {
      window.dispatchEvent(new GamepadEvent('gamepadconnected', { gamepad: pad as unknown as Gamepad }));
    } catch {
      window.dispatchEvent(new Event('gamepadconnected'));
    }
  });
}

/** Presses and releases a pad button with a hold long enough to span several frames. */
async function padTap(page: Page, index: number, holdMs = 120): Promise<void> {
  await page.evaluate((i) => (window as unknown as { __PAD__: { press(i: number): void } }).__PAD__.press(i), index);
  await page.waitForTimeout(holdMs);
  await page.evaluate((i) => (window as unknown as { __PAD__: { release(i: number): void } }).__PAD__.release(i), index);
  await page.waitForTimeout(140);
}

const A = 0;
const MENU = 9;
const DPAD_DOWN = 13;
const DPAD_RIGHT = 15;

test('a gamepad is detected and drives the title menu', async ({ page, errorWatcher }) => {
  test.setTimeout(60_000);
  void errorWatcher;
  await installGamepad(page);

  // Seed a save so Continue is a live target, then return to the title.
  await openGame(page);
  await startNewGame(page);
  await page.evaluate(() => window.__GAME_TEST__?.saveNow());
  await page.reload();
  await waitForMainMenu(page);
  await page.waitForTimeout(700);

  // A D-pad press moves the highlight and flips the active device to gamepad.
  const first = await page.evaluate(() => window.__GAME_TEST__?.getMenuSelection());
  await padTap(page, DPAD_DOWN);
  await expect.poll(() => page.evaluate(() => window.__GAME_TEST__?.getActiveDevice())).toBe('gamepad');
  await expect.poll(() => page.evaluate(() => window.__GAME_TEST__?.getMenuSelection())).not.toBe(first);

  // Drive to Continue and confirm with A.
  while ((await page.evaluate(() => window.__GAME_TEST__?.getMenuSelection())) !== 'Continue') {
    await padTap(page, DPAD_DOWN);
  }
  await padTap(page, A);
  await expect.poll(() => getCurrentMap(page), MAP_LOAD).toBe('village');
});

test('the gamepad moves the hero and opens the pause menu in the world', async ({ page, errorWatcher }) => {
  test.setTimeout(60_000);
  void errorWatcher;
  await installGamepad(page);

  await openGame(page);
  await startNewGame(page);
  const before = await getPlayerState(page);

  // Hold the left stick right; the hero should walk and face right.
  await page.evaluate(() => (window as unknown as { __PAD__: { axis(i: number, v: number): void } }).__PAD__.axis(0, 1));
  try {
    await expect.poll(async () => (await getPlayerState(page)).x).toBeGreaterThan(before.x + 12);
  } finally {
    await page.evaluate(() => (window as unknown as { __PAD__: { axis(i: number, v: number): void } }).__PAD__.axis(0, 0));
  }
  await expect.poll(async () => (await getPlayerState(page)).facing).toBe('right');
  await expect.poll(() => page.evaluate(() => window.__GAME_TEST__?.getActiveDevice())).toBe('gamepad');

  // The Menu button opens the shared pause menu.
  await padTap(page, MENU);
  await expect.poll(() => page.evaluate(() => window.__GAME_TEST__?.getMenuSelection())).toBe('Resume');

  // D-pad navigates the pause rows; A on Resume closes it back to gameplay.
  await padTap(page, DPAD_DOWN);
  await expect.poll(() => page.evaluate(() => window.__GAME_TEST__?.getMenuSelection())).not.toBe('Resume');
  await padTap(page, DPAD_RIGHT); // no-op guard: some rows adjust, must not crash
  // Return to Resume and confirm.
  while ((await page.evaluate(() => window.__GAME_TEST__?.getMenuSelection())) !== 'Resume') {
    await page.evaluate(() => (window as unknown as { __PAD__: { press(i: number): void; release(i: number): void } }).__PAD__.press(12));
    await page.waitForTimeout(120);
    await page.evaluate(() => (window as unknown as { __PAD__: { release(i: number): void } }).__PAD__.release(12));
    await page.waitForTimeout(140);
  }
  await padTap(page, A);
  await expect.poll(() => page.evaluate(() => window.__GAME_TEST__?.getMenuSelection())).toBeNull();
});
