import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from './fixtures';
import type { Page } from './fixtures';
import { openGame, startNewGame, waitForMainMenu } from './helpers/game';

/**
 * Screenshots of the release-candidate surfaces at 1366x768, the narrowest supported laptop size. Runs with
 * `npm run test:shots` next to the playthrough baseline; the default suite ignores it.
 */

const OUT = resolve(process.cwd(), 'artifacts', 'playthrough');

async function shot(page: Page, name: string, settle = 700): Promise<void> {
  await page.waitForTimeout(settle);
  await page.screenshot({ path: resolve(OUT, `rc-${name}.png`) });
}

/** Menus ignore input for 160 ms after opening or switching pages. */
async function tap(page: Page, key: string, settle = 260): Promise<void> {
  await page.keyboard.press(key);
  await page.waitForTimeout(settle);
}

test('captures the release-candidate surfaces at 1366x768 @shots', async ({ page, errorWatcher }) => {
  test.setTimeout(240_000);
  void errorWatcher;
  mkdirSync(OUT, { recursive: true });
  await page.setViewportSize({ width: 1366, height: 768 });

  await openGame(page);
  await waitForMainMenu(page);
  await shot(page, 'title', 1800);

  // No save yet, so Continue is skipped: New Game → Options → Controls → Credits.
  await tap(page, 'ArrowDown');
  await tap(page, 'Enter');
  await shot(page, 'options');
  await tap(page, 'Escape');
  await tap(page, 'ArrowDown');
  await tap(page, 'Enter');
  await shot(page, 'controls');
  await tap(page, 'Enter');
  await shot(page, 'rebind-listening');
  await tap(page, 'Escape', 400);
  await tap(page, 'Escape');
  await tap(page, 'ArrowDown');
  await tap(page, 'Enter');
  await shot(page, 'credits');
  await tap(page, 'Escape');
  await tap(page, 'ArrowUp');
  await tap(page, 'ArrowUp');
  await tap(page, 'ArrowUp');

  await startNewGame(page);
  await tap(page, 'Escape');
  await shot(page, 'pause');
  await tap(page, 'ArrowDown');
  await tap(page, 'ArrowDown');
  await tap(page, 'ArrowDown');
  await tap(page, 'Enter');
  await shot(page, 'save-data');
  await tap(page, 'Escape');
  await tap(page, 'Escape');

  // With a save in the slot the title shows Continue metadata and warns before a New Game.
  await page.evaluate(() => window.__GAME_TEST__?.saveNow());
  await page.reload();
  await waitForMainMenu(page);
  await page.waitForTimeout(900);
  await shot(page, 'title-with-save', 600);
  await tap(page, 'Enter', 500);
  await shot(page, 'new-game-warning');
});
