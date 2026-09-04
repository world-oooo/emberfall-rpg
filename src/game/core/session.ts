import { SAVE_VERSION } from '../config/constants';
import type { Facing } from '../entities/player/heroAnimations';

export interface InventoryEntry {
  itemId: string;
  quantity: number;
}

export type QuestStatus = 'locked' | 'available' | 'active' | 'completed' | 'rewarded';

export interface QuestProgress {
  status: QuestStatus;
  /** objective id -> progress count */
  objectives: Record<string, number>;
}

export interface PlayerSave {
  mapId: string;
  spawnId: string;
  x?: number;
  y?: number;
  facing: Facing;
  hp: number;
  maxHp: number;
  level: number;
  xp: number;
  coins: number;
}

/** Everything that persists. Plain data only; versioned; migrated in SaveSystem. */
export interface SaveGame {
  saveVersion: number;
  player: PlayerSave;
  inventory: InventoryEntry[];
  equipment: { weapon: string | null; accessory: string | null };
  quests: Record<string, QuestProgress>;
  flags: Record<string, boolean | number | string>;
  openedChests: string[];
  defeatedBosses: string[];
  playtimeMs: number;
  savedAt: number;
}

export function createNewSave(): SaveGame {
  return {
    saveVersion: SAVE_VERSION,
    player: {
      mapId: 'village',
      spawnId: 'start',
      facing: 'down',
      hp: 6,
      maxHp: 6,
      level: 1,
      xp: 0,
      coins: 0,
    },
    inventory: [
      { itemId: 'katana', quantity: 1 },
      { itemId: 'rice_ball', quantity: 2 },
    ],
    equipment: { weapon: 'katana', accessory: null },
    quests: {},
    flags: {},
    openedChests: [],
    defeatedBosses: [],
    playtimeMs: 0,
    savedAt: 0,
  };
}

/**
 * Live session: the save being played plus runtime-only state.
 * Created on New Game / Continue; scenes read and mutate it through systems.
 */
export class GameSession {
  /** Pending map transition, consumed by WorldScene on restart. */
  pendingSpawn: { mapId: string; spawnId: string } | null = null;
  /** Wall-clock start of this play session for playtime accounting. */
  private sessionStart = performance.now();

  constructor(public save: SaveGame) {}

  accumulatePlaytime(): void {
    const now = performance.now();
    this.save.playtimeMs += now - this.sessionStart;
    this.sessionStart = now;
  }

  getFlag(key: string): boolean | number | string | undefined {
    return this.save.flags[key];
  }

  setFlag(key: string, value: boolean | number | string): void {
    this.save.flags[key] = value;
  }
}

let current: GameSession | null = null;

export function startNewSession(save: SaveGame = createNewSave()): GameSession {
  current = new GameSession(save);
  return current;
}

export function getSession(): GameSession {
  if (!current) throw new Error('No active game session');
  return current;
}

export function hasSession(): boolean {
  return current !== null;
}

export function endSession(): void {
  current = null;
}
