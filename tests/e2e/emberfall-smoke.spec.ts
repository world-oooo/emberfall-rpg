import { expect, test } from './fixtures';
import { damageEnemy, getCurrentMap, getEnemies, getPlayerState, getSave, openGame, startNewGame, teleport, waitForMainMenu } from './helpers/game';

test('boots to a playable WebGL canvas on the main menu', async ({ page, errorWatcher }) => {
  void errorWatcher;

  await openGame(page);
  await waitForMainMenu(page);

  await expect(page.locator('canvas')).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => window.__GAME_TEST__?.rendererType()))
    .toBe('webgl');
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

test('transitions from the village south gate to Whispering Woods', async ({ page, errorWatcher }) => {
  void errorWatcher;

  await openGame(page);
  await startNewGame(page);
  await teleport(page, 328, 472);

  await expect.poll(() => getCurrentMap(page)).toBe('woods');
  await expect.poll(async () => (await getSave(page)).player.mapId).toBe('woods');
  await expect.poll(async () => (await getSave(page)).player.spawnId).toBe('from_village');
  await expect.poll(async () => (await getEnemies(page)).length).toBe(10);
});

test('opens Elder Hana dialogue and starts the main quest', async ({ page, errorWatcher }) => {
  void errorWatcher;

  await openGame(page);
  await startNewGame(page);
  await teleport(page, 152, 240);
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(250);
  await page.keyboard.press('Enter');

  await expect.poll(async () => (await getSave(page)).quests?.quest_dimmed_shrine?.status).toBe('active');
});

test('spawns forest enemies and resolves a real player attack', async ({ page, errorWatcher }) => {
  void errorWatcher;

  await openGame(page);
  await startNewGame(page);
  await teleport(page, 328, 472);
  await expect.poll(() => getCurrentMap(page)).toBe('woods');
  const slime = (await getEnemies(page)).find((enemy) => enemy.spawnId === 'slime_01');
  expect(slime).toBeDefined();
  if (!slime) return;

  await teleport(page, slime.x - 18, slime.y);
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(80);
  await page.keyboard.press('KeyJ');

  await expect.poll(async () => (await getEnemies(page)).find((enemy) => enemy.spawnId === 'slime_01')?.hp).toBeLessThan(slime.hp);
});

test('opens a chest and throws a consumable shuriken', async ({ page, errorWatcher }) => {
  void errorWatcher;

  await openGame(page);
  await startNewGame(page);
  await teleport(page, 328, 472);
  await expect.poll(() => getCurrentMap(page)).toBe('woods');

  await teleport(page, 200, 382);
  await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(100);
  await page.keyboard.press('KeyE');
  await expect.poll(async () => (await getSave(page)).inventory?.find((entry) => entry.itemId === 'shuriken')?.quantity).toBe(5);

  const slime = (await getEnemies(page)).find((enemy) => enemy.spawnId === 'slime_02');
  expect(slime).toBeDefined();
  if (!slime) return;
  await teleport(page, slime.x - 28, slime.y);
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(100);
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
  await page.waitForTimeout(450);
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

  await page.keyboard.press('KeyI');
  await page.waitForTimeout(200);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await getPlayerState(page)).hp).toBe(6);
  await expect.poll(async () => (await getSave(page)).inventory?.find((entry) => entry.itemId === 'rice_ball')?.quantity).toBe(1);

  await page.keyboard.press('Escape');
  await page.waitForTimeout(220);
  const volumeBefore = await page.evaluate(() => window.__GAME_TEST__?.getSettings().masterVolume);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowLeft');
  await expect.poll(() => page.evaluate(() => window.__GAME_TEST__?.getSettings().masterVolume)).toBeCloseTo((volumeBefore ?? 0.8) - 0.1, 5);

  await page.keyboard.press('Escape');
  await page.waitForTimeout(220);
  const before = await getPlayerState(page);
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(300);
  await page.keyboard.up('KeyD');
  await expect.poll(async () => (await getPlayerState(page)).x).toBeGreaterThan(before.x + 10);
});

test('completes the Ember quest, saves, reloads, and continues', async ({ page, errorWatcher }) => {
  test.setTimeout(60_000);
  void errorWatcher;

  const interactFacingUp = async (x: number, y: number): Promise<void> => {
    await teleport(page, x, y);
    await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(100);
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(260);
  };

  await openGame(page);
  await startNewGame(page);

  await interactFacingUp(152, 240);
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await getSave(page)).quests?.quest_dimmed_shrine?.status).toBe('active');

  await interactFacingUp(504, 208);
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await getSave(page)).quests?.quest_dimmed_shrine?.objectives.talk_ryo).toBe(1);

  await teleport(page, 328, 472);
  await expect.poll(() => getCurrentMap(page)).toBe('woods');
  for (const spawnId of ['slime_01', 'slime_02', 'slime_03', 'slime_04']) expect(await damageEnemy(page, spawnId)).toBe(true);
  await expect.poll(async () => (await getSave(page)).quests?.quest_dimmed_shrine?.objectives.defeat_slimes).toBe(4);

  await teleport(page, 808, 80);
  await expect.poll(() => getCurrentMap(page)).toBe('shrine');
  await expect.poll(async () => (await getSave(page)).quests?.quest_sleeping_guardian?.status).toBe('active');
  await expect.poll(async () => (await getSave(page)).player.maxHp).toBe(8);

  await interactFacingUp(120, 350);
  await expect.poll(async () => (await getSave(page)).inventory?.some((entry) => entry.itemId === 'shrine_key')).toBe(true);

  await teleport(page, 240, 216);
  await expect.poll(async () => (await getPlayerState(page)).y).toBeLessThan(210);
  await expect.poll(async () => (await getEnemies(page)).some((enemy) => enemy.spawnId === 'guardian_tanuki')).toBe(true);
  expect(await damageEnemy(page, 'guardian_tanuki')).toBe(true);
  await expect.poll(async () => (await getSave(page)).defeatedBosses?.includes('boss_racoon')).toBe(true);

  await interactFacingUp(248, 78);
  await expect.poll(async () => (await getSave(page)).inventory?.some((entry) => entry.itemId === 'ember')).toBe(true);

  await teleport(page, 240, 632);
  await expect.poll(() => getCurrentMap(page)).toBe('woods');
  await teleport(page, 488, 8);
  await expect.poll(() => getCurrentMap(page)).toBe('village');

  await interactFacingUp(152, 240);
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await getSave(page)).quests?.quest_sleeping_guardian?.objectives.return_hana).toBe(1);

  await teleport(page, 328, 110);
  await page.keyboard.press('ArrowUp');
  await expect.poll(() => page.evaluate(() => window.__GAME_TEST__?.getActiveInteraction())).toBe('shrine_ember');
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(260);
  await expect.poll(async () => (await getSave(page)).flags?.['ending.relit_shrine']).toBe(true);
  await page.evaluate(() => window.__GAME_TEST__?.saveNow());

  await page.reload();
  await waitForMainMenu(page);
  await page.waitForTimeout(500);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => getCurrentMap(page)).toBe('village');
  await expect.poll(async () => (await getSave(page)).flags?.['ending.relit_shrine']).toBe(true);
});
