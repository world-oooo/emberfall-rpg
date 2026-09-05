import { expect, type Page } from '../fixtures';

export interface PlayerState {
  x: number;
  y: number;
  facing: string;
  state: string | null;
  hp: number;
  maxHp: number;
}

export interface GameSave {
  player: {
    mapId: string;
    spawnId: string;
    hp: number;
    maxHp: number;
    coins: number;
    level: number;
  };
  inventory?: Array<{ itemId: string; quantity: number }>;
  quests?: Record<string, { status: string; objectives: Record<string, number> }>;
  flags?: Record<string, boolean | number | string>;
  defeatedBosses?: string[];
}

export interface EnemyState {
  enemyId: string;
  spawnId: string;
  hp: number;
  maxHp: number;
  x: number;
  y: number;
  dead: boolean;
  state: string;
}

declare global {
  interface Window {
    __GAME_TEST__?: {
      ready: boolean;
      rendererType: () => 'webgl' | 'canvas' | 'unknown';
      activeScenes: () => string[];
      getPlayerState: () => PlayerState | null;
      getCurrentMap: () => string | null;
      getSave: () => GameSave | null;
      getInventory: () => unknown;
      getQuests: () => unknown;
      getSettings: () => { masterVolume: number; musicVolume: number; sfxVolume: number; screenShake: boolean; displayMode: 'fill' | 'fixed'; showHints: boolean; fullscreen: boolean };
      getDisplay: () => { zoom: number; width: number; height: number; canvasWidth: number; canvasHeight: number; mode: 'fill' | 'fixed' };
      getEnemies: () => unknown[];
      getActiveInteraction: () => string | null;
      startScene: (key: string, data?: object) => void;
      teleport: (x: number, y: number) => void;
      damageEnemy: (spawnId: string, amount?: number) => boolean;
      damagePlayer: (amount?: number) => boolean;
      healPlayer: (amount?: number) => boolean;
      saveNow: () => Promise<void>;
      getMenuSelection: () => string | null;
      getUiState: () => { dialogue: boolean; panel: string | null; special: boolean; menu: string | null };
      getActiveDevice: () => 'keyboard' | 'gamepad';
      getBootTimeline: () => { preloadCompleteAt: number; menuReadyAt: number };
    };
  }
}

export async function openGame(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForFunction(() => window.__GAME_TEST__?.ready === true);
}

export async function waitForScene(page: Page, sceneKey: string): Promise<void> {
  await page.waitForFunction((key) => window.__GAME_TEST__?.activeScenes().includes(key), sceneKey);
}

export async function waitForMainMenu(page: Page): Promise<void> {
  await waitForScene(page, 'MainMenuScene');
}

export async function startNewGame(page: Page): Promise<void> {
  await waitForMainMenu(page);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__GAME_TEST__?.getCurrentMap() === 'village');
}

export async function getCurrentMap(page: Page): Promise<string | null> {
  return page.evaluate(() => window.__GAME_TEST__?.getCurrentMap() ?? null);
}

export async function getPlayerState(page: Page): Promise<PlayerState> {
  const state = await page.evaluate(() => window.__GAME_TEST__?.getPlayerState() ?? null);
  expect(state).not.toBeNull();
  return state as PlayerState;
}

export async function getSave(page: Page): Promise<GameSave> {
  const save = await page.evaluate(() => window.__GAME_TEST__?.getSave() ?? null);
  expect(save).not.toBeNull();
  return save as GameSave;
}

export async function teleport(page: Page, x: number, y: number): Promise<void> {
  await page.evaluate(({ targetX, targetY }) => window.__GAME_TEST__?.teleport(targetX, targetY), { targetX: x, targetY: y });
}

export async function getEnemies(page: Page): Promise<EnemyState[]> {
  return page.evaluate(() => window.__GAME_TEST__?.getEnemies() as EnemyState[] ?? []);
}

export async function damageEnemy(page: Page, spawnId: string, amount = 999): Promise<boolean> {
  return page.evaluate(({ id, damage }) => window.__GAME_TEST__?.damageEnemy(id, damage) ?? false, { id: spawnId, damage: amount });
}

/**
 * Walks a whole conversation. Dialogue reveals letter by letter, so the first confirm only completes the
 * reveal; keep confirming until the player leaves the interact state, which is when the box has closed.
 */
export async function talkTo(page: Page, x: number, y: number, facing = 'ArrowUp'): Promise<void> {
  const playerState = async (): Promise<string | null> => page.evaluate(() => window.__GAME_TEST__?.getPlayerState()?.state ?? null);

  // Opening is retried, and only once the game reports an interaction target: key delivery latency varies
  // between engines, and a press that lands before the target has been picked simply does nothing.
  for (let attempt = 0; attempt < 8; attempt += 1) {
    if ((await playerState()) === 'interact') break;
    await teleport(page, x, y);
    await page.keyboard.press(facing);
    await page.waitForTimeout(160);
    const target = await page.evaluate(() => window.__GAME_TEST__?.getActiveInteraction() ?? null);
    if (!target) continue;
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(220);
  }

  for (let i = 0; i < 15; i += 1) {
    await page.waitForTimeout(250);
    if ((await playerState()) !== 'interact') return;
    await page.keyboard.press('Enter');
  }
}

/** Closes any open dialogue or panel so a following key press reaches the world. */
export async function clearModals(page: Page): Promise<void> {
  for (let i = 0; i < 6; i += 1) {
    const state = await page.evaluate(() => window.__GAME_TEST__?.getPlayerState()?.state ?? null);
    if (state !== 'interact') return;
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
  }
}

/**
 * Interacts with whatever prop is at (x, y). Waits until the game reports an interaction target before
 * pressing, because a press delivered before the target is picked is silently lost — which showed up as
 * engine-specific flakiness rather than as a failure at the press itself.
 */
export async function interactAt(page: Page, x: number, y: number, facing = 'ArrowUp'): Promise<string | null> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    await teleport(page, x, y);
    await page.keyboard.press(facing);
    await page.waitForTimeout(160);
    const target = await page.evaluate(() => window.__GAME_TEST__?.getActiveInteraction() ?? null);
    if (!target) continue;
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(320);
    return target;
  }
  return null;
}

/** Reads which menu row is currently highlighted (title entry or open release submenu). */
export async function menuSelection(page: Page): Promise<string | null> {
  return page.evaluate(() => window.__GAME_TEST__?.getMenuSelection() ?? null);
}

/**
 * Moves the highlight to a row by its label and presses to activate it — how a sighted player navigates,
 * instead of counting arrow presses, which drifts when a slow runner drops or reorders taps.
 */
export async function menuActivate(page: Page, label: string, direction: 'ArrowDown' | 'ArrowUp' = 'ArrowDown'): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const current = await menuSelection(page);
    if (current === label) {
      await page.keyboard.press('Enter');
      await page.waitForTimeout(250);
      return;
    }
    await page.keyboard.press(direction);
    await page.waitForTimeout(160);
  }
  throw new Error(`Menu row "${label}" never highlighted (last: ${await menuSelection(page)})`);
}

/** Moves the highlight to a menu row by label without activating it (for rows whose action needs a live event). */
export async function selectRow(page: Page, label: string): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if ((await menuSelection(page)) === label) return;
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(160);
  }
  throw new Error(`Menu row "${label}" never highlighted (last: ${await menuSelection(page)})`);
}

/**
 * Menus drop a press that lands inside their ready delay, and under a loaded CPU a page switch can land late
 * enough that a fixed settle is not enough. Press until the file chooser arrives.
 */
export async function pressForFileChooser(page: Page, key = 'Enter'): Promise<import('@playwright/test').FileChooser> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const waiting = page.waitForEvent('filechooser', { timeout: 2_500 }).catch(() => null);
    await page.keyboard.press(key);
    const value = await waiting;
    if (value) return value;
    await page.waitForTimeout(200);
  }
  throw new Error(`No file chooser after pressing ${key}`);
}
