import { expect, test } from './fixtures';
import { clearModals, damageEnemy, getCurrentMap, getEnemies, getPlayerState, getSave, openGame, startNewGame, talkTo, teleport, waitForMainMenu } from './helpers/game';

/**
 * A first visit to a map downloads its tilesets, sheets and music. Under the software WebGL used here that
 * costs ~3 s, which the 5 s default poll only just covers, so cross-map waits get their own budget.
 */
const MAP_LOAD = { timeout: 20_000 };

test('boots to a playable WebGL canvas on the main menu', async ({ page, errorWatcher }) => {
  void errorWatcher;

  await openGame(page);
  await waitForMainMenu(page);

  await expect(page.locator('canvas')).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => window.__GAME_TEST__?.rendererType()))
    .toBe('webgl');
});

test('fills the browser window with the game canvas', async ({ page, errorWatcher }) => {
  void errorWatcher;

  await openGame(page);
  await waitForMainMenu(page);

  const layout = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return { width: rect.width, height: rect.height, innerWidth: window.innerWidth, innerHeight: window.innerHeight };
  });
  expect(layout).not.toBeNull();
  if (!layout) return;
  // The old fixed 320x180 canvas covered barely half the window; the resize path must claim all of it.
  expect(layout.width / layout.innerWidth).toBeGreaterThan(0.98);
  expect(layout.height / layout.innerHeight).toBeGreaterThan(0.98);
});

test('starts a new game in Kagehara Village with the initial player save', async ({ page, errorWatcher }) => {
  void errorWatcher;

  await openGame(page);
  await startNewGame(page);

  await expect.poll(() => getCurrentMap(page)).toBe('village');
  await expect.poll(async () => (await getPlayerState(page)).hp).toBe(6);
  await expect.poll(async () => (await getSave(page)).player.spawnId).toBe('start');
});

test('moves the player when holding a movement key', async ({ page, errorWatcher }) => {
  void errorWatcher;

  await openGame(page);
  await startNewGame(page);
  const before = await getPlayerState(page);

  await page.keyboard.down('KeyD');
  await page.waitForTimeout(500);
  await page.keyboard.up('KeyD');

  await expect.poll(async () => (await getPlayerState(page)).x).toBeGreaterThan(before.x + 20);
  await expect.poll(async () => (await getPlayerState(page)).facing).toBe('right');
});

test('resolves an attack inside its animation and hands control back', async ({ page, errorWatcher }) => {
  void errorWatcher;

  await openGame(page);
  await startNewGame(page);
  await page.keyboard.press('KeyJ');

  // Sampled in-page: the swing is 240 ms long, far too short to observe reliably over the CDP round trip.
  const observed = await page.evaluate(async () => {
    const bridge = window.__GAME_TEST__;
    if (!bridge) return null;
    const seen = new Set<string>();
    for (let i = 0; i < 90; i += 1) {
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
      const state = bridge.getPlayerState()?.state;
      if (state) seen.add(state);
    }
    return { seen: [...seen], last: bridge.getPlayerState()?.state ?? null };
  });
  expect(observed).not.toBeNull();
  if (!observed) return;
  expect(observed.seen).toContain('attack');
  // A stuck attack state was the old symptom: logic ended while the animation kept playing.
  expect(['idle', 'move']).toContain(observed.last);
});

test('transitions from the village south gate to Whispering Woods', async ({ page, errorWatcher }) => {
  test.setTimeout(60_000);
  void errorWatcher;

  await openGame(page);
  await startNewGame(page);
  await teleport(page, 328, 472);

  await expect.poll(() => getCurrentMap(page), MAP_LOAD).toBe('woods');
  await expect.poll(async () => (await getSave(page)).player.mapId).toBe('woods');
  await expect.poll(async () => (await getSave(page)).player.spawnId).toBe('from_village');
  await expect.poll(async () => (await getEnemies(page)).length).toBe(10);
});

test('opens Elder Hana dialogue and starts the main quest', async ({ page, errorWatcher }) => {
  void errorWatcher;

  await openGame(page);
  await startNewGame(page);
  await talkTo(page, 152, 240);

  await expect.poll(async () => (await getSave(page)).quests?.quest_dimmed_shrine?.status).toBe('active');
});

test('spawns forest enemies and resolves a real player attack', async ({ page, errorWatcher }) => {
  test.setTimeout(60_000);
  void errorWatcher;

  await openGame(page);
  await startNewGame(page);
  await teleport(page, 328, 472);
  await expect.poll(() => getCurrentMap(page), MAP_LOAD).toBe('woods');
  const slime = (await getEnemies(page)).find((enemy) => enemy.spawnId === 'slime_01');
  expect(slime).toBeDefined();
  if (!slime) return;

  // Slimes hop, so a single swing can whiff: step back into range and swing again until one connects.
  const swingAtSlime = async (): Promise<number> => {
    const current = (await getEnemies(page)).find((enemy) => enemy.spawnId === 'slime_01');
    if (!current) return 0;
    await teleport(page, current.x - 18, current.y);
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('KeyJ');
    await page.waitForTimeout(300);
    return (await getEnemies(page)).find((enemy) => enemy.spawnId === 'slime_01')?.hp ?? 0;
  };
  await expect.poll(swingAtSlime, { timeout: 20_000 }).toBeLessThan(slime.hp);
});

test('opens a chest and throws a consumable shuriken', async ({ page, errorWatcher }) => {
  test.setTimeout(60_000);
  void errorWatcher;

  await openGame(page);
  await startNewGame(page);
  await teleport(page, 328, 472);
  await expect.poll(() => getCurrentMap(page), MAP_LOAD).toBe('woods');

  // chest_woods_hut sits at (200, 368); stand one tile below it and face up.
  await teleport(page, 200, 384);
  await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(150);
  await page.keyboard.press('KeyE');
  await expect.poll(async () => (await getSave(page)).inventory?.find((entry) => entry.itemId === 'shuriken')?.quantity).toBe(5);

  const slime = (await getEnemies(page)).find((enemy) => enemy.spawnId === 'slime_02');
  expect(slime).toBeDefined();
  if (!slime) return;
  await teleport(page, slime.x - 28, slime.y);
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(150);
  await page.keyboard.press('KeyL');

  await expect.poll(async () => (await getSave(page)).inventory?.find((entry) => entry.itemId === 'shuriken')?.quantity).toBe(4);
  await expect.poll(async () => (await getEnemies(page)).find((enemy) => enemy.spawnId === 'slime_02')?.hp).toBeLessThan(slime.hp);
});

test('recovers from death at the current checkpoint', async ({ page, errorWatcher }) => {
  void errorWatcher;

  await openGame(page);
  await startNewGame(page);
  expect(await page.evaluate(() => window.__GAME_TEST__?.damagePlayer())).toBe(true);
  await expect.poll(async () => (await getPlayerState(page)).hp).toBe(0);
  await page.waitForTimeout(600);
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await getPlayerState(page)).hp).toBe(6);
  await expect.poll(() => getCurrentMap(page)).toBe('village');
});

test('uses an inventory item and persists pause-menu settings', async ({ page, errorWatcher }) => {
  void errorWatcher;

  await openGame(page);
  await startNewGame(page);
  expect(await page.evaluate(() => window.__GAME_TEST__?.damagePlayer(2))).toBe(true);
  await expect.poll(async () => (await getPlayerState(page)).hp).toBe(4);

  // The inventory is a five-column icon grid: katana in slot 0, rice ball in slot 1, so move right, not down.
  await page.keyboard.press('KeyI');
  await page.waitForTimeout(300);
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(150);
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await getPlayerState(page)).hp).toBe(6);
  await expect.poll(async () => (await getSave(page)).inventory?.find((entry) => entry.itemId === 'rice_ball')?.quantity).toBe(1);

  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  const volumeBefore = await page.evaluate(() => window.__GAME_TEST__?.getSettings().masterVolume);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // Pause rows: Resume, Volume, Screen Shake, Display, Hints.
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowLeft');
  await expect.poll(() => page.evaluate(() => window.__GAME_TEST__?.getSettings().masterVolume)).toBeCloseTo((volumeBefore ?? 0.8) - 0.1, 5);

  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => page.evaluate(() => window.__GAME_TEST__?.getSettings().displayMode)).toBe('fixed');
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => page.evaluate(() => window.__GAME_TEST__?.getSettings().displayMode)).toBe('fill');

  await page.keyboard.press('Escape');
  await page.waitForTimeout(320);
  const before = await getPlayerState(page);
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(400);
  await page.keyboard.up('KeyD');
  await expect.poll(async () => (await getPlayerState(page)).x).toBeGreaterThan(before.x + 10);
});

test('completes the Ember quest, saves, reloads, and continues', async ({ page, errorWatcher }) => {
  test.setTimeout(180_000);
  void errorWatcher;

  const interactFacingUp = async (x: number, y: number): Promise<void> => {
    await teleport(page, x, y);
    await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(150);
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(360);
    await clearModals(page);
  };

  await openGame(page);
  await startNewGame(page);

  await talkTo(page, 152, 240);
  await expect.poll(async () => (await getSave(page)).quests?.quest_dimmed_shrine?.status).toBe('active');

  await talkTo(page, 504, 208);
  await expect.poll(async () => (await getSave(page)).quests?.quest_dimmed_shrine?.objectives.talk_ryo).toBe(1);

  await teleport(page, 328, 472);
  await expect.poll(() => getCurrentMap(page), MAP_LOAD).toBe('woods');
  for (const spawnId of ['slime_01', 'slime_02', 'slime_03', 'slime_04']) expect(await damageEnemy(page, spawnId)).toBe(true);
  await expect.poll(async () => (await getSave(page)).quests?.quest_dimmed_shrine?.objectives.defeat_slimes).toBe(4);

  await teleport(page, 808, 80);
  await expect.poll(() => getCurrentMap(page), MAP_LOAD).toBe('shrine');
  await expect.poll(async () => (await getSave(page)).quests?.quest_sleeping_guardian?.status).toBe('active');
  await expect.poll(async () => (await getSave(page)).player.maxHp).toBe(8);

  // chest_shrine_key at (120, 320) in the west room.
  await interactFacingUp(120, 336);
  await expect.poll(async () => (await getSave(page)).inventory?.some((entry) => entry.itemId === 'shrine_key')).toBe(true);

  // The stair is barred by a seal, not a doorway: spend the key, then walk into the arena.
  await interactFacingUp(248, 256);
  await expect.poll(async () => (await getSave(page)).flags?.['shrine.seal_open']).toBe(true);

  await teleport(page, 248, 176);
  await expect.poll(async () => (await getEnemies(page)).some((enemy) => enemy.spawnId === 'guardian_tanuki')).toBe(true);
  expect(await damageEnemy(page, 'guardian_tanuki')).toBe(true);
  await expect.poll(async () => (await getSave(page)).defeatedBosses?.includes('boss_racoon')).toBe(true);
  // Let the death beat (hitstop, flash, victory cue) finish before driving input again.
  await page.waitForTimeout(1200);

  await interactFacingUp(248, 64);
  await expect.poll(async () => (await getSave(page)).inventory?.some((entry) => entry.itemId === 'ember')).toBe(true);

  await teleport(page, 240, 632);
  await expect.poll(() => getCurrentMap(page), MAP_LOAD).toBe('woods');
  await teleport(page, 488, 8);
  await expect.poll(() => getCurrentMap(page), MAP_LOAD).toBe('village');

  await talkTo(page, 152, 240);
  await expect.poll(async () => (await getSave(page)).quests?.quest_sleeping_guardian?.objectives.return_hana).toBe(1);

  await teleport(page, 328, 110);
  await page.keyboard.press('ArrowUp');
  await expect.poll(() => page.evaluate(() => window.__GAME_TEST__?.getActiveInteraction())).toBe('shrine_ember');
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(400);
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

test('lights the shrine braziers to open the vault and unbars the shortcut', async ({ page, errorWatcher }) => {
  test.setTimeout(90_000);
  void errorWatcher;

  const use = async (x: number, y: number, facing: string): Promise<void> => {
    await teleport(page, x, y);
    await page.keyboard.press(facing);
    await page.waitForTimeout(150);
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(400);
  };

  await openGame(page);
  await startNewGame(page);
  await teleport(page, 328, 472);
  await expect.poll(() => getCurrentMap(page), MAP_LOAD).toBe('woods');
  await teleport(page, 808, 80);
  await expect.poll(() => getCurrentMap(page), MAP_LOAD).toBe('shrine');

  // Four cold braziers: two in the entrance hall, two in the lower hall.
  for (const [x, y] of [[184, 616], [296, 616], [152, 412], [328, 412]] as [number, number][]) await use(x, y, 'ArrowUp');
  await expect.poll(async () => (await getSave(page)).flags?.['shrine.braziers_lit']).toBe(true);

  // The vault seal asks for the puzzle flag, not a key.
  await use(136, 480, 'ArrowUp');
  await expect.poll(async () => (await getSave(page)).flags?.['shrine.vault_open']).toBe(true);
  await use(104, 480, 'ArrowLeft');
  await expect.poll(async () => (await getSave(page)).inventory?.some((entry) => entry.itemId === 'heavy_blade')).toBe(true);

  // The keepers' passage is barred from the arena side and drops back to the entrance hall.
  await use(440, 64, 'ArrowDown');
  await expect.poll(async () => (await getSave(page)).flags?.['shrine.shortcut_open']).toBe(true);
  await teleport(page, 440, 300);
  await page.waitForTimeout(400);
  await expect.poll(async () => (await getPlayerState(page)).y).toBeGreaterThan(250);
  await expect.poll(() => getCurrentMap(page)).toBe('shrine');
});

test('opens the hidden grove chest in the village', async ({ page, errorWatcher }) => {
  void errorWatcher;

  await openGame(page);
  await startNewGame(page);
  const coinsBefore = (await getSave(page)).player.coins;
  await teleport(page, 568, 112);
  await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(150);
  await page.keyboard.press('KeyE');

  await expect.poll(async () => (await getSave(page)).player.coins).toBeGreaterThan(coinsBefore);
});

test('never lets more than two regular enemies swing at once', async ({ page, errorWatcher }) => {
  test.setTimeout(90_000);
  void errorWatcher;

  await openGame(page);
  await startNewGame(page);
  await teleport(page, 328, 472);
  await expect.poll(() => getCurrentMap(page), MAP_LOAD).toBe('woods');
  await teleport(page, 808, 80);
  await expect.poll(() => getCurrentMap(page), MAP_LOAD).toBe('shrine');
  await page.waitForTimeout(1200);

  // The bat gallery puts two bats and a Hollow Guard inside one aggro radius. Sampled in-page: a wind-up
  // lasts 120-280 ms, which a poll driven from Node would step straight over.
  const observed = await page.evaluate(async () => {
    const bridge = window.__GAME_TEST__;
    if (!bridge) return null;
    const engaged = new Set<string>();
    let peak = 0;
    for (let i = 0; i < 170; i += 1) {
      bridge.teleport(330, 320);
      bridge.healPlayer();
      const live = (bridge.getEnemies() as Array<{ spawnId: string; state: string; dead: boolean }>).filter((enemy) => !enemy.dead);
      const committed = live.filter((enemy) => enemy.state === 'windup' || enemy.state === 'attack');
      for (const enemy of committed) engaged.add(enemy.spawnId);
      peak = Math.max(peak, committed.length);
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return { peak, engaged: engaged.size };
  });

  expect(observed).not.toBeNull();
  if (!observed) return;
  // More than two enemies took turns, and never more than two were committed at the same moment.
  expect(observed.engaged).toBeGreaterThan(2);
  expect(observed.peak).toBeLessThanOrEqual(2);
});
