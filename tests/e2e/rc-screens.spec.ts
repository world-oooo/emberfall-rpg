import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from './fixtures';
import type { Page } from './fixtures';
import { menuActivate, menuSelection, openGame, startNewGame, talkTo, waitForMainMenu } from './helpers/game';

/**
 * Screenshots of the release-candidate surfaces at 1366x768, the narrowest supported laptop size. Runs with
 * `npm run test:shots` next to the playthrough baseline; the default suite ignores it.
 */

const OUT = resolve(process.cwd(), 'artifacts', 'playthrough');

async function shot(page: Page, name: string, settle = 700): Promise<void> {
  await page.waitForTimeout(settle);
  await writeShot(page, resolve(OUT, `rc-${name}.png`));
}

/** Windows occasionally holds a just-written PNG open (indexer, AV); retry the write briefly rather than fail the pass. */
async function writeShot(page: Page, path: string): Promise<void> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      await page.screenshot({ path });
      return;
    } catch (error) {
      if (attempt >= 3) throw error;
      await page.waitForTimeout(350);
    }
  }
}

/** Moves the highlight to a row by label without activating it. */
async function selectRow(page: Page, label: string): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if ((await menuSelection(page)) === label) return;
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(160);
  }
  throw new Error(`Menu row "${label}" never highlighted`);
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
  // Fixed View: the letterboxed display mode, toggled from Options and restored afterwards.
  await tap(page, 'Escape');
  await menuActivate(page, 'Options');
  await selectRow(page, 'Display');
  await tap(page, 'Enter', 500);
  await tap(page, 'Escape');
  await tap(page, 'Escape', 500);
  await shot(page, 'fixed-view');
  await tap(page, 'Escape');
  await menuActivate(page, 'Options');
  await selectRow(page, 'Display');
  await tap(page, 'Enter', 500);
  await tap(page, 'Escape');
  await tap(page, 'Escape', 400);
  // Quest log, Botan's shop and the game-over card: the three in-world surfaces the playthrough never shows.
  await tap(page, 'KeyQ', 500);
  await shot(page, 'quest-log');
  await tap(page, 'Escape', 400);
  await talkTo(page, 104, 336);
  await shot(page, 'shop-dialogue', 500);
  await tap(page, 'Enter', 600);
  await shot(page, 'shop');
  await tap(page, 'Escape', 500);
  await page.evaluate(() => window.__GAME_TEST__?.damagePlayer());
  await shot(page, 'game-over', 1600);
  await tap(page, 'Enter', 900);

  // With a save in the slot the title shows Continue metadata and warns before a New Game.
  await page.evaluate(() => window.__GAME_TEST__?.saveNow());
  await page.reload();
  await waitForMainMenu(page);
  await page.waitForTimeout(900);
  await shot(page, 'title-with-save', 600);
  await tap(page, 'Enter', 500);
  await shot(page, 'new-game-warning');
});
