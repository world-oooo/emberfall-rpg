import type Phaser from 'phaser';
import { hasSession, getSession } from '../core/session';
import type { WorldScene } from '../scenes/WorldScene';

/**
 * DEV-only read-mostly API for Playwright: window.__GAME_TEST__.
 * Never shipped: main.ts only installs it when import.meta.env.DEV is true, so it is tree-shaken from production.
 */
export interface GameTestBridge {
  ready: boolean;
  rendererType: () => 'webgl' | 'canvas' | 'unknown';
  activeScenes: () => string[];
  getPlayerState: () => { x: number; y: number; facing: string; state: string | null; hp: number; maxHp: number } | null;
  getCurrentMap: () => string | null;
  getSave: () => unknown;
  getInventory: () => unknown;
  getQuests: () => unknown;
  getEnemies: () => unknown[];
  startScene: (key: string, data?: object) => void;
  teleport: (x: number, y: number) => void;
}

export function installTestBridge(game: Phaser.Game): void {
  const world = (): WorldScene | null => {
    const s = game.scene.getScene('WorldScene') as WorldScene | null;
    return s && game.scene.isActive('WorldScene') ? s : null;
  };
  const bridge: GameTestBridge = {
    ready: false,
    rendererType: () => (game.renderer?.type === 2 ? 'webgl' : game.renderer?.type === 1 ? 'canvas' : 'unknown'),
    activeScenes: () => game.scene.getScenes(true).map((s) => s.scene.key),
    getPlayerState: () => {
      const w = world();
      if (!w || !w.player) return null;
      const save = getSession().save;
      return { x: w.player.x, y: w.player.y, facing: w.player.facing, state: w.player.fsm.name, hp: save.player.hp, maxHp: save.player.maxHp };
    },
    getCurrentMap: () => world()?.mapDef.id ?? null,
    getSave: () => (hasSession() ? structuredClone(getSession().save) : null),
    getInventory: () => (hasSession() ? structuredClone(getSession().save.inventory) : null),
    getQuests: () => (hasSession() ? structuredClone(getSession().save.quests) : null),
    getEnemies: () => [],
    startScene: (key, data) => game.scene.start(key, data),
    teleport: (x, y) => world()?.player.setPosition(x, y),
  };
  (window as unknown as { __GAME_TEST__: GameTestBridge }).__GAME_TEST__ = bridge;
  game.events.once('ready', () => {
    bridge.ready = true;
  });
}
