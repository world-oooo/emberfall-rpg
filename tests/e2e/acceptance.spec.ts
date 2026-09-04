import { expect, test } from './fixtures';
import { damageEnemy, getCurrentMap, getSave, interactAt, openGame, startNewGame, talkTo, teleport, waitForMainMenu } from './helpers/game';
import type { Page } from './fixtures';

/**
 * Completion matrix: the whole game, start to Continue, at every viewport the design has to support.
 * Run with `npm run test:matrix`. Excluded from the default suite because it repeats the long story test.
 */

const VIEWPORTS: Array<[number, number]> = [
  [1366, 768],
  [1440, 900],
  [1920, 1080],
];

// WebKit decodes the same audio and tilesets noticeably slower than Chromium, so the budget is generous.
const MAP_LOAD = { timeout: 45_000 };

async function interactFacingUp(page: Page, x: number, y: number): Promise<void> {
  await interactAt(page, x, y);
}

for (const [width, height] of VIEWPORTS) {
  test(`completes the game at ${width}x${height} @matrix`, async ({ page, errorWatcher }) => {
    test.setTimeout(240_000);
    void errorWatcher;

    await page.setViewportSize({ width, height });
    await openGame(page);
    await waitForMainMenu(page);

    // The canvas must claim the window at every one of these sizes; that was the headline defect.
    const layout = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      const rect = canvas?.getBoundingClientRect();
      return rect ? { width: rect.width, height: rect.height } : null;
    });
    expect(layout).not.toBeNull();
    if (layout) {
      expect(layout.width / width).toBeGreaterThan(0.98);
      expect(layout.height / height).toBeGreaterThan(0.98);
    }
    // Nothing may make the page itself scrollable.
    const scrolls = await page.evaluate(() => ({
      x: document.documentElement.scrollWidth > window.innerWidth,
      y: document.documentElement.scrollHeight > window.innerHeight,
    }));
    expect(scrolls).toEqual({ x: false, y: false });

    await startNewGame(page);
    await talkTo(page, 152, 240);
    await expect.poll(async () => (await getSave(page)).quests?.quest_dimmed_shrine?.status).toBe('active');
    await talkTo(page, 504, 208);

    await teleport(page, 328, 472);
    await expect.poll(() => getCurrentMap(page), MAP_LOAD).toBe('woods');
    await interactFacingUp(page, 200, 384);
    await expect.poll(async () => (await getSave(page)).inventory?.some((entry) => entry.itemId === 'shuriken')).toBe(true);
    for (const spawnId of ['slime_01', 'slime_02', 'slime_03', 'slime_04']) expect(await damageEnemy(page, spawnId)).toBe(true);

    await teleport(page, 808, 80);
    await expect.poll(() => getCurrentMap(page), MAP_LOAD).toBe('shrine');
    // Clear the halls first, the way a player would. This run checks that the game can be finished, not that
    // a hero standing still through a dozen scripted interactions survives the Hollow Guards.
    for (const spawnId of ['shrine_skeleton_01', 'shrine_skeleton_02', 'shrine_skeleton_03', 'shrine_skeleton_04', 'shrine_bat_01', 'shrine_bat_02', 'shrine_bat_03']) {
      expect(await damageEnemy(page, spawnId)).toBe(true);
    }
    for (const [bx, by] of [[184, 616], [296, 616], [152, 412], [328, 412]] as [number, number][]) await interactFacingUp(page, bx, by);
    await expect.poll(async () => (await getSave(page)).flags?.['shrine.braziers_lit']).toBe(true);
    await interactFacingUp(page, 136, 480);
    await interactFacingUp(page, 104, 480);

    await interactFacingUp(page, 120, 336);
    await expect.poll(async () => (await getSave(page)).inventory?.some((entry) => entry.itemId === 'shrine_key')).toBe(true);
    await interactFacingUp(page, 248, 256);
    await expect.poll(async () => (await getSave(page)).flags?.['shrine.seal_open']).toBe(true);

    await teleport(page, 248, 176);
    await page.waitForTimeout(700);
    expect(await damageEnemy(page, 'guardian_tanuki')).toBe(true);
    await expect.poll(async () => (await getSave(page)).defeatedBosses?.includes('boss_racoon')).toBe(true);
    await page.waitForTimeout(1200);
    await interactFacingUp(page, 248, 64);
    await expect.poll(async () => (await getSave(page)).inventory?.some((entry) => entry.itemId === 'ember')).toBe(true);

    await teleport(page, 240, 632);
    await expect.poll(() => getCurrentMap(page), MAP_LOAD).toBe('woods');
    await teleport(page, 488, 8);
    await expect.poll(() => getCurrentMap(page), MAP_LOAD).toBe('village');
    await talkTo(page, 152, 240);
    // Relighting needs both preconditions, so check them separately: a failure here should say which one.
    await expect.poll(async () => (await getSave(page)).quests?.quest_sleeping_guardian?.objectives.return_hana).toBe(1);
    await interactFacingUp(page, 328, 110);
    await expect.poll(async () => (await getSave(page)).flags?.['ending.relit_shrine']).toBe(true);
    await page.evaluate(() => window.__GAME_TEST__?.saveNow());

    await page.reload();
    await waitForMainMenu(page);
    await page.waitForTimeout(700);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect.poll(() => getCurrentMap(page), MAP_LOAD).toBe('village');
    await expect.poll(async () => (await getSave(page)).flags?.['ending.relit_shrine']).toBe(true);
  });
}
