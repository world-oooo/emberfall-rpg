import { readFile } from 'node:fs/promises';
import { expect, test } from './fixtures';
import type { Page } from './fixtures';
import { damageEnemy, getCurrentMap, getPlayerState, getSave, interactAt, menuActivate, menuSelection, openGame, pressForFileChooser, selectRow, startNewGame, talkTo, teleport, waitForMainMenu, waitForScene } from './helpers/game';

/**
 * Release-candidate surface: controls, save management, fullscreen, credits, the side quest and the ending
 * choices. Everything here drives the real menus with the keyboard; the DEV bridge only reads state and
 * shortens travel.
 */

const MAP_LOAD = { timeout: 30_000 };
/** Menus ignore input for 160 ms after opening or switching pages. */
const MENU_SETTLE = 260;

async function press(page: Page, key: string, settle = MENU_SETTLE): Promise<void> {
  await page.keyboard.press(key);
  await page.waitForTimeout(settle);
}

async function activeScenes(page: Page): Promise<string[]> {
  return page.evaluate(() => window.__GAME_TEST__?.activeScenes() ?? []);
}

async function storedBindings(page: Page): Promise<Record<string, string[]> | null> {
  return page.evaluate(() => {
    const raw = localStorage.getItem('emberfall.inputBindings.v1');
    return raw ? (JSON.parse(raw) as Record<string, string[]>) : null;
  });
}

/** Reads the save slot straight from IndexedDB, which also works on the title screen where there is no session. */
async function readSlot(page: Page): Promise<{ player?: { mapId?: string; level?: number; coins?: number }; savedAt?: number } | null> {
  return page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const request = indexedDB.open('emberfall');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains('saves')) {
            db.close();
            resolve(null);
            return;
          }
          const tx = db.transaction('saves', 'readonly');
          const get = tx.objectStore('saves').get('slot_1');
          get.onerror = () => reject(get.error);
          get.onsuccess = () => resolve((get.result as never) ?? null);
          tx.oncomplete = () => db.close();
        };
      }),
  );
}

/** Samples the player's FSM inside the page: a 240 ms swing is too short to observe over the CDP round trip. */
async function seesAttackAfter(page: Page, code: string, keyCode: number): Promise<boolean> {
  return page.evaluate(
    async ({ c, k }) => {
      const bridge = window.__GAME_TEST__;
      if (!bridge) return false;
      const fire = (type: string) => window.dispatchEvent(new KeyboardEvent(type, { code: c, keyCode: k, which: k, bubbles: true }));
      fire('keydown');
      await new Promise((resolve) => setTimeout(resolve, 40));
      fire('keyup');
      let seen = false;
      for (let i = 0; i < 40; i += 1) {
        await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
        if (bridge.getPlayerState()?.state === 'attack') seen = true;
      }
      return seen;
    },
    { c: code, k: keyCode },
  );
}

test('rebinds attack from the pause controls screen, rejects a conflict, and keeps the binding after reload', async ({ page, errorWatcher }) => {
  test.setTimeout(90_000);
  void errorWatcher;

  await openGame(page);
  await startNewGame(page);
  expect(await seesAttackAfter(page, 'KeyJ', 74)).toBe(true);
  expect(await seesAttackAfter(page, 'KeyU', 85)).toBe(false);

  // Pause → Controls → Attack → listen → K is owned by Roll and must be refused.
  await press(page, 'Escape');
  await menuActivate(page, 'Controls');
  await menuActivate(page, 'Attack');
  await press(page, 'KeyK', 320);
  expect((await storedBindings(page))?.attack ?? null).toBeNull();

  // Same row again, bind U.
  await menuActivate(page, 'Attack');
  await press(page, 'KeyU', 320);
  await expect.poll(async () => (await storedBindings(page))?.attack).toEqual(['KeyU']);

  // Back out through pause to the world; U now swings and J no longer does.
  await press(page, 'Escape');
  await press(page, 'Escape', 400);
  await expect.poll(async () => (await getPlayerState(page)).state).not.toBe('interact');
  expect(await seesAttackAfter(page, 'KeyU', 85)).toBe(true);
  expect(await seesAttackAfter(page, 'KeyJ', 74)).toBe(false);

  // Bindings live outside the save and survive a reload.
  await page.evaluate(() => window.__GAME_TEST__?.saveNow());
  await page.reload();
  await waitForMainMenu(page);
  await page.waitForTimeout(700);
  await menuActivate(page, 'Continue');
  await expect.poll(() => getCurrentMap(page), MAP_LOAD).toBe('village');
  await page.waitForTimeout(400);
  expect((await storedBindings(page))?.attack).toEqual(['KeyU']);
  expect(await seesAttackAfter(page, 'KeyU', 85)).toBe(true);
});

test('saves and quits to the title, then Continue resumes the same journey', async ({ page, errorWatcher }) => {
  test.setTimeout(90_000);
  void errorWatcher;

  await openGame(page);
  await startNewGame(page);
  await interactAt(page, 568, 112);
  await expect.poll(async () => (await getSave(page)).player.coins).toBe(50);
  await teleport(page, 200, 300);
  await page.waitForTimeout(200);

  await press(page, 'Escape');
  await menuActivate(page, 'Save & Quit');
  await waitForMainMenu(page);
  await expect.poll(() => activeScenes(page)).toEqual(['MainMenuScene']);
  await expect.poll(async () => (await readSlot(page))?.player?.coins).toBe(50);

  await page.waitForTimeout(700);
  await menuActivate(page, 'Continue');
  await expect.poll(() => getCurrentMap(page), MAP_LOAD).toBe('village');
  const state = await getPlayerState(page);
  expect(Math.abs(state.x - 200)).toBeLessThan(12);
  expect((await getSave(page)).player.coins).toBe(50);
});

test('exports the save as a download and imports a validated file from the title screen', async ({ page, errorWatcher }) => {
  test.setTimeout(120_000);
  void errorWatcher;

  await openGame(page);
  await startNewGame(page);
  await teleport(page, 328, 472);
  await expect.poll(() => getCurrentMap(page), MAP_LOAD).toBe('woods');
  await page.evaluate(() => window.__GAME_TEST__?.saveNow());

  // Pause → Save Data → Export Save. Arm the download listener before the Enter that triggers it.
  await press(page, 'Escape');
  await menuActivate(page, 'Save Data');
  await selectRow(page, 'Export Save');
  const downloadPromise = page.waitForEvent('download', { timeout: 10_000 });
  await page.keyboard.press('Enter');
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('emberfall-save.json');
  const path = await download.path();
  expect(path).not.toBeNull();
  const exported = JSON.parse(await readFile(path as string, 'utf8')) as { saveVersion: number; player: { mapId: string; level: number } };
  expect(exported.player.mapId).toBe('woods');

  // Back to the title through Save & Quit, then import a modified copy from Options → Save Data → Import.
  await press(page, 'Escape');
  await menuActivate(page, 'Save & Quit');
  await waitForMainMenu(page);
  await page.waitForTimeout(700);

  const modified = { ...exported, player: { ...exported.player, level: 4 } };
  await menuActivate(page, 'Options');
  await menuActivate(page, 'Save Data');
  // The file chooser opens when the Import row is activated; highlight it, then trigger the picker.
  await selectRow(page, 'Import Save');
  const chooser = await pressForFileChooser(page);
  await chooser.setFiles({ name: 'emberfall-save.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(modified)) });
  await menuActivate(page, 'Confirm');
  await expect.poll(async () => (await readSlot(page))?.player?.level).toBe(4);

  // A broken file must be refused before it can touch the slot.
  await selectRow(page, 'Import Save');
  const chooser2 = await pressForFileChooser(page);
  await chooser2.setFiles({ name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from('{"saveVersion":') });
  await page.waitForTimeout(500);
  expect((await readSlot(page))?.player?.level).toBe(4);

  // The imported save is what Continue loads.
  await press(page, 'Escape');
  await press(page, 'Escape', 300);
  await menuActivate(page, 'Continue');
  await expect.poll(() => getCurrentMap(page), MAP_LOAD).toBe('woods');
  expect((await getSave(page)).player.level).toBe(4);
});

test('toggles fullscreen from options without breaking the display, and falls back cleanly when blocked', async ({ page, errorWatcher }) => {
  void errorWatcher;

  await openGame(page);
  await startNewGame(page);
  await press(page, 'Escape');
  await menuActivate(page, 'Options');
  await selectRow(page, 'Fullscreen');
  await press(page, 'Enter', 600);

  const state = await page.evaluate(() => ({
    fullscreen: document.fullscreenElement !== null,
    setting: window.__GAME_TEST__?.getSettings().fullscreen ?? null,
    display: window.__GAME_TEST__?.getDisplay() ?? null,
  }));
  // Whatever the browser decided, the stored preference must match reality and the display must still be sane.
  expect(state.setting).toBe(state.fullscreen);
  expect(state.display?.zoom).toBeGreaterThanOrEqual(2);
  expect((state.display?.width ?? 0) * (state.display?.zoom ?? 0)).toBeLessThanOrEqual(state.display?.canvasWidth ?? 0);

  await press(page, 'Enter', 600);
  expect(await page.evaluate(() => document.fullscreenElement)).toBeNull();
  // Back out of Options and the pause menu; the release menu is closed once nothing is highlighted.
  await expect
    .poll(async () => {
      if ((await menuSelection(page)) === null) return null;
      await page.keyboard.press('Escape');
      await page.waitForTimeout(220);
      return menuSelection(page);
    })
    .toBeNull();
  await expect.poll(async () => (await getPlayerState(page)).state).not.toBe('interact');
});

test('opens credits from the title and returns to a working menu', async ({ page, errorWatcher }) => {
  void errorWatcher;

  await openGame(page);
  await waitForMainMenu(page);
  await page.waitForTimeout(700);
  await menuActivate(page, 'Credits');
  await press(page, 'Escape', 400);
  await menuActivate(page, 'New Game');
  await expect.poll(() => getCurrentMap(page), MAP_LOAD).toBe('village');
});

test("completes Mimi's Lost Charm side quest through the real systems and keeps it after a reload", async ({ page, errorWatcher }) => {
  test.setTimeout(120_000);
  void errorWatcher;

  await openGame(page);
  await startNewGame(page);
  const coinsBefore = (await getSave(page)).player.coins;

  await talkTo(page, 376, 304);
  await expect.poll(async () => (await getSave(page)).quests?.quest_lost_charm?.status).toBe('active');

  await teleport(page, 328, 472);
  await expect.poll(() => getCurrentMap(page), MAP_LOAD).toBe('woods');
  await interactAt(page, 104, 160);
  await expect.poll(async () => (await getSave(page)).inventory?.some((entry) => entry.itemId === 'fox_charm')).toBe(true);
  await expect.poll(async () => (await getSave(page)).quests?.quest_lost_charm?.objectives.find_charm).toBe(1);

  await teleport(page, 488, 8);
  await expect.poll(() => getCurrentMap(page), MAP_LOAD).toBe('village');
  await talkTo(page, 376, 304);
  await expect.poll(async () => (await getSave(page)).quests?.quest_lost_charm?.status).toBe('rewarded');
  const save = await getSave(page);
  expect(save.player.coins).toBe(coinsBefore + 15);
  expect(save.inventory?.some((entry) => entry.itemId === 'life_potion')).toBe(true);
  expect(save.inventory?.some((entry) => entry.itemId === 'fox_charm')).toBe(true);

  await page.evaluate(() => window.__GAME_TEST__?.saveNow());
  await page.reload();
  await waitForMainMenu(page);
  await page.waitForTimeout(700);
  await press(page, 'ArrowDown');
  await press(page, 'Enter');
  await expect.poll(() => getCurrentMap(page), MAP_LOAD).toBe('village');
  await expect.poll(async () => (await getSave(page)).quests?.quest_lost_charm?.status).toBe('rewarded');
});

test('ending card offers Return to Title, which saves the restored world', async ({ page, errorWatcher }) => {
  test.setTimeout(180_000);
  void errorWatcher;

  await openGame(page);
  await startNewGame(page);
  await talkTo(page, 152, 240);
  await talkTo(page, 504, 208);
  await teleport(page, 328, 472);
  await expect.poll(() => getCurrentMap(page), MAP_LOAD).toBe('woods');
  for (const spawnId of ['slime_01', 'slime_02', 'slime_03', 'slime_04']) expect(await damageEnemy(page, spawnId)).toBe(true);
  await teleport(page, 808, 80);
  await expect.poll(() => getCurrentMap(page), MAP_LOAD).toBe('shrine');
  for (const spawnId of ['shrine_skeleton_01', 'shrine_skeleton_02', 'shrine_skeleton_03', 'shrine_skeleton_04', 'shrine_bat_01', 'shrine_bat_02', 'shrine_bat_03']) {
    await damageEnemy(page, spawnId);
  }
  await interactAt(page, 120, 336);
  await interactAt(page, 248, 256);
  await expect.poll(async () => (await getSave(page)).flags?.['shrine.seal_open']).toBe(true);
  await teleport(page, 248, 176);
  await page.waitForTimeout(700);
  expect(await damageEnemy(page, 'guardian_tanuki')).toBe(true);
  await expect.poll(async () => (await getSave(page)).defeatedBosses?.includes('boss_racoon')).toBe(true);
  await page.waitForTimeout(1200);
  await interactAt(page, 248, 64);
  await teleport(page, 240, 632);
  await expect.poll(() => getCurrentMap(page), MAP_LOAD).toBe('woods');
  await teleport(page, 488, 8);
  await expect.poll(() => getCurrentMap(page), MAP_LOAD).toBe('village');
  await talkTo(page, 152, 240);
  await interactAt(page, 328, 110);
  await expect.poll(async () => (await getSave(page)).flags?.['ending.relit_shrine']).toBe(true);

  // The card arms 400 ms after it appears. Second choice is Return to Title.
  await page.waitForTimeout(700);
  await press(page, 'ArrowDown');
  await press(page, 'Enter');
  await waitForScene(page, 'MainMenuScene');
  await expect.poll(() => activeScenes(page)).toEqual(['MainMenuScene']);

  await page.waitForTimeout(700);
  await press(page, 'ArrowDown');
  await press(page, 'Enter');
  await expect.poll(() => getCurrentMap(page), MAP_LOAD).toBe('village');
  await expect.poll(async () => (await getSave(page)).flags?.['ending.relit_shrine']).toBe(true);
});
