import { expect, test } from './fixtures';
import type { Page } from './fixtures';
import { getCurrentMap, menuSelection, openGame, waitForMainMenu } from './helpers/game';

/**
 * Some environments (IMEs, virtual keyboards, remote desktops) deliver keydown with an empty `code` while still
 * setting `key` or `keyCode`. Edges must still register; a player there cannot otherwise press Enter.
 */

const MAP_LOAD = { timeout: 30_000 };

type KeyInit = { key: string; code: string; keyCode: number; which: number };

async function tap(page: Page, init: KeyInit): Promise<void> {
  await page.evaluate((i) => {
    const fire = (type: string) => window.dispatchEvent(new KeyboardEvent(type, { ...i, bubbles: true }));
    fire('keydown');
    setTimeout(() => fire('keyup'), 60);
  }, init);
  await page.waitForTimeout(260);
}

test('a keydown with only `key` set still confirms and navigates the menu', async ({ page, errorWatcher }) => {
  void errorWatcher;
  await openGame(page);
  await waitForMainMenu(page);
  await page.waitForTimeout(700);

  const first = await menuSelection(page);
  await tap(page, { key: 'ArrowDown', code: '', keyCode: 0, which: 0 });
  await expect.poll(() => menuSelection(page)).not.toBe(first);
  await tap(page, { key: 'ArrowUp', code: '', keyCode: 0, which: 0 });
  await expect.poll(() => menuSelection(page)).toBe(first);

  await tap(page, { key: 'Enter', code: '', keyCode: 0, which: 0 });
  await expect.poll(() => getCurrentMap(page), MAP_LOAD).toBe('village');
});

test('a keydown with only `keyCode` set still confirms', async ({ page, errorWatcher }) => {
  void errorWatcher;
  await openGame(page);
  await waitForMainMenu(page);
  await page.waitForTimeout(700);

  await tap(page, { key: '', code: '', keyCode: 13, which: 13 });
  await expect.poll(() => getCurrentMap(page), MAP_LOAD).toBe('village');
});
