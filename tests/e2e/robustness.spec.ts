import { expect, test } from './fixtures';
import { damageEnemy, getCurrentMap, getEnemies, getPlayerState, getSave, interactAt, menuActivate, menuSelection, openGame, startNewGame, talkTo, teleport, waitForMainMenu } from './helpers/game';

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

test('pausing mid-boss-fight freezes the fight and resuming continues it', async ({ page, errorWatcher }) => {
  void errorWatcher;
  test.setTimeout(150_000);
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

  const boss = async () => (await getEnemies(page)).find((enemy) => enemy.spawnId === 'guardian_tanuki') ?? null;
  // The intro (sleep -> wake) ends in idle; pause there, in the fight proper.
  await expect.poll(async () => (await boss())?.state, { timeout: 20_000 }).toBe('idle');

  // Pause: nothing in the fight may advance.
  await page.keyboard.press('Escape');
  await expect.poll(() => menuSelection(page)).toBe('Resume');
  const frozen = await boss();
  const heroHp = (await getPlayerState(page)).hp;
  await page.waitForTimeout(1200);
  const still = await boss();
  expect(still?.state).toBe(frozen?.state);
  expect(still?.hp).toBe(frozen?.hp);
  expect(still?.x).toBe(frozen?.x);
  expect(still?.y).toBe(frozen?.y);
  expect((await getPlayerState(page)).hp).toBe(heroHp);

  // Resume: the Keeper leaves idle for an attack within a few seconds and is still the same, living boss.
  await page.keyboard.press('Enter');
  await expect.poll(() => menuSelection(page)).toBeNull();
  await expect.poll(async () => (await boss())?.state, { timeout: 8_000 }).not.toBe('idle');
  expect((await boss())?.dead).toBe(false);
});

test('pausing next to an enemy freezes it and the damage it would deal', async ({ page, errorWatcher }) => {
  void errorWatcher;
  await openGame(page);
  await startNewGame(page);
  await teleport(page, 328, 472);
  await expect.poll(() => getCurrentMap(page), MAP_LOAD).toBe('woods');
  const slime = async () => (await getEnemies(page)).find((e) => e.spawnId === 'slime_01') ?? null;
  const s0 = await slime();
  await teleport(page, Math.round((s0?.x ?? 0) + 28), Math.round(s0?.y ?? 0));
  await page.waitForTimeout(250);
  await page.keyboard.press('Escape');
  await expect.poll(() => menuSelection(page)).toBe('Resume');
  const hp = (await getPlayerState(page)).hp;
  const p0 = await slime();
  await page.waitForTimeout(1500);
  const p1 = await slime();
  expect(Math.hypot((p1?.x ?? 0) - (p0?.x ?? 0), (p1?.y ?? 0) - (p0?.y ?? 0))).toBeLessThan(1);
  expect((await getPlayerState(page)).hp).toBe(hp);

  // Resume: the slime is live again and closes in.
  await page.keyboard.press('Enter');
  await expect.poll(() => menuSelection(page)).toBeNull();
  await expect
    .poll(async () => {
      const s = await slime();
      return Math.hypot((s?.x ?? 0) - (p1?.x ?? 0), (s?.y ?? 0) - (p1?.y ?? 0));
    }, { timeout: 5_000 })
    .toBeGreaterThan(2);
});

test('the ending card\'s Continue Exploring returns control in the restored village', async ({ page, errorWatcher }) => {
  void errorWatcher;
  test.setTimeout(180_000);
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

  // First choice, Continue Exploring: the card closes and the hero is free in the same, restored village.
  await page.waitForTimeout(700);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);
  expect(await getCurrentMap(page)).toBe('village');
  const before = await getPlayerState(page);
  await page.keyboard.down('KeyD');
  try {
    await expect.poll(async () => (await getPlayerState(page)).x).toBeGreaterThan(before.x + 6);
  } finally {
    await page.keyboard.up('KeyD');
  }
  expect((await getSave(page)).flags?.['ending.relit_shrine']).toBe(true);
});

test('rebinding a movement key works for walking, which reads held keys rather than presses', async ({ page, errorWatcher }) => {
  void errorWatcher;
  await openGame(page);
  await startNewGame(page);
  const start = await getPlayerState(page);

  // Pause -> Controls -> Move Right -> listen -> O (a key nothing else owns; L would be refused as Throw's).
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  await menuActivate(page, 'Controls');
  await menuActivate(page, 'Move Right');
  await page.keyboard.press('KeyO');
  await page.waitForTimeout(400);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  await page.keyboard.press('Escape');
  await expect.poll(() => menuSelection(page)).toBeNull();
  await page.waitForTimeout(300);

  // O walks right now; D, which the rebind replaced, no longer does.
  await page.keyboard.down('KeyO');
  try {
    await expect.poll(async () => (await getPlayerState(page)).x).toBeGreaterThan(start.x + 8);
  } finally {
    await page.keyboard.up('KeyO');
  }
  // Let the hero decelerate to a stop before measuring, or momentum reads as movement.
  await page.waitForTimeout(400);
  const mid = await getPlayerState(page);
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(500);
  await page.keyboard.up('KeyD');
  expect(Math.abs((await getPlayerState(page)).x - mid.x)).toBeLessThan(2);
});

test('Reset Options restores the defaults', async ({ page, errorWatcher }) => {
  void errorWatcher;
  await openGame(page);
  await startNewGame(page);
  const defaults = await page.evaluate(() => window.__GAME_TEST__?.getSettings() ?? null);

  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  await menuActivate(page, 'Options');
  // Master is the first row: lower it twice.
  await page.keyboard.press('ArrowLeft');
  await page.waitForTimeout(200);
  await page.keyboard.press('ArrowLeft');
  await expect.poll(() => page.evaluate(() => window.__GAME_TEST__?.getSettings().masterVolume)).toBeLessThan(defaults?.masterVolume ?? 1);
  await menuActivate(page, 'Reset Options');
  await menuActivate(page, 'Confirm');
  await expect.poll(() => page.evaluate(() => window.__GAME_TEST__?.getSettings().masterVolume)).toBe(defaults?.masterVolume);
});

test('dying to the boss respawns at the checkpoint and the fight restarts fresh', async ({ page, errorWatcher }) => {
  void errorWatcher;
  test.setTimeout(180_000);
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
  const boss = async () => (await getEnemies(page)).find((enemy) => enemy.spawnId === 'guardian_tanuki') ?? null;
  await teleport(page, 248, 176);
  await expect.poll(async () => (await boss())?.state, { timeout: 20_000 }).toBe('idle');
  // Take a real bite out of it, then die.
  expect(await damageEnemy(page, 'guardian_tanuki', 30)).toBe(true);
  await expect.poll(async () => (await boss())?.hp).toBeLessThan((await boss())?.maxHp ?? 0);
  expect(await page.evaluate(() => window.__GAME_TEST__?.damagePlayer())).toBe(true);
  await expect.poll(async () => (await getPlayerState(page)).hp).toBe(0);
  await page.waitForTimeout(1500);
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await getPlayerState(page)).hp, { timeout: 15_000 }).toBeGreaterThan(0);
  await expect.poll(() => getCurrentMap(page), MAP_LOAD).toBe('shrine');
  await page.waitForTimeout(600);

  // Back in the arena: the Keeper is asleep again at full health and wakes for a fresh fight; the seal stays open.
  expect((await getSave(page)).flags?.['shrine.seal_open']).toBe(true);
  const fresh = await boss();
  expect(fresh?.dead).toBe(false);
  expect(fresh?.hp).toBe(fresh?.maxHp);
  await teleport(page, 248, 176);
  await expect.poll(async () => (await boss())?.state, { timeout: 20_000 }).toBe('idle');
  const hero = await getPlayerState(page);
  expect(hero.hp).toBe(hero.maxHp);
});
