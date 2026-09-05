import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from './fixtures';
import { clearModals, damageEnemy, getCurrentMap, openGame, startNewGame, talkTo, teleport } from './helpers/game';
import type { Page } from './fixtures';

/**
 * Regenerates the screenshot baseline in artifacts/playthrough. Run with `npm run test:shots`.
 * It walks the whole game in order, so the folder doubles as a visual record of the current build.
 */

const OUT = resolve(process.cwd(), 'artifacts', 'playthrough');
const MAP_LOAD = { timeout: 30_000 };

let step = 0;
async function shot(page: Page, name: string, settle = 700): Promise<void> {
  step += 1;
  await page.waitForTimeout(settle);
  const path = resolve(OUT, `${String(step).padStart(2, '0')}-${name}.png`);
  // Windows occasionally holds a just-written PNG open (indexer, AV); retry the write briefly rather than fail the pass.
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

test('captures the playthrough baseline @shots', async ({ page, errorWatcher }) => {
  test.setTimeout(300_000);
  void errorWatcher;
  mkdirSync(OUT, { recursive: true });
  await page.setViewportSize({ width: 1280, height: 720 });

  await openGame(page);
  await shot(page, 'main-menu', 1400);

  await startNewGame(page);
  // This is a capture tool, not a gameplay test: the hero stands still in hostile rooms while frames are
  // taken, so keep them topped up. A game-over card mid-run would restart the map and ruin every later frame.
  await page.evaluate(() => {
    const bridge = window.__GAME_TEST__;
    (window as unknown as { __shotHeal?: number }).__shotHeal = window.setInterval(() => bridge?.healPlayer(), 200);
  });
  await shot(page, 'village');

  // Dialogue box: portrait, typewriter body, choices below it.
  await teleport(page, 152, 240);
  await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(150);
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(1400);
  await shot(page, 'dialogue');
  await clearModals(page);

  await page.keyboard.press('KeyI');
  await shot(page, 'inventory');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  await page.keyboard.press('Escape');
  await shot(page, 'pause-menu');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // Village shrine hill, still cold.
  await teleport(page, 328, 176);
  await shot(page, 'village-shrine');

  // Hidden grove behind the dojo.
  await teleport(page, 568, 112);
  await shot(page, 'hidden-grove');

  await talkTo(page, 152, 240);
  await talkTo(page, 504, 208);

  await teleport(page, 328, 472);
  await expect_map(page, 'woods');
  await shot(page, 'woods', 1200);

  for (const spawnId of ['slime_01', 'slime_02', 'slime_03', 'slime_04']) await damageEnemy(page, spawnId);
  await teleport(page, 808, 80);
  await expect_map(page, 'shrine');
  await shot(page, 'shrine-entrance', 1200);

  // Brazier puzzle and the vault it opens.
  for (const [x, y] of [[184, 616], [296, 616], [152, 412], [328, 412]] as [number, number][]) {
    await teleport(page, x, y);
    await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(150);
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(350);
  }
  // Framed so both entrance-hall braziers are in view, and settled long enough for the toast to clear.
  await teleport(page, 240, 604);
  await shot(page, 'braziers-lit', 2600);
  await teleport(page, 136, 480);
  await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(150);
  await page.keyboard.press('KeyE');
  await teleport(page, 104, 470);
  await shot(page, 'keepers-vault');

  // Key, seal, arena.
  await teleport(page, 120, 336);
  await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(150);
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(350);
  await teleport(page, 248, 256);
  await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(150);
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(400);
  await shot(page, 'seal-open');

  await teleport(page, 248, 176);
  await shot(page, 'boss-arena', 1100);
  // Past the phase-two threshold (140 HP boss): the phase toast is on screen at rest ~450 ms after it fires.
  await damageEnemy(page, 'guardian_tanuki', 100);
  await shot(page, 'boss-fight', 450);
  await damageEnemy(page, 'guardian_tanuki');
  await shot(page, 'boss-defeated', 1600);

  await teleport(page, 248, 64);
  await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(150);
  await page.keyboard.press('KeyE');
  await shot(page, 'ember-taken');

  await teleport(page, 240, 632);
  await expect_map(page, 'woods');
  await teleport(page, 488, 8);
  await expect_map(page, 'village');
  await talkTo(page, 152, 240);

  await teleport(page, 328, 110);
  await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(200);
  await page.keyboard.press('KeyE');
  await shot(page, 'ending-card', 1600);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(600);
  await teleport(page, 328, 160);
  await shot(page, 'village-relit', 1600);
  await page.evaluate(() => {
    const handle = (window as unknown as { __shotHeal?: number }).__shotHeal;
    if (handle !== undefined) window.clearInterval(handle);
  });
});

async function expect_map(page: Page, mapId: string): Promise<void> {
  await page.waitForFunction((id) => window.__GAME_TEST__?.getCurrentMap() === id, mapId, MAP_LOAD);
  void getCurrentMap;
}
