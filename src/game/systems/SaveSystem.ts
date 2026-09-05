import { createStore, del, get, set } from 'idb-keyval';
import { SAVE_VERSION, STORAGE_NAMESPACE } from '../config/constants';
import { createNewSave, type SaveGame } from '../core/session';
import { ENEMIES } from '../data/enemies';
import { ITEMS, type ItemDefinition } from '../data/items';
import { MAPS } from '../data/maps';
import { QUESTS, type QuestDefinition } from '../data/quests';
import type { Facing } from '../entities/player/heroAnimations';

export const SAVE_SLOT_KEY = 'slot_1';
export const SAVE_META_KEY = 'meta';

interface SaveMeta {
  savedAt: number;
  saveVersion: number;
  level: number;
  mapId: string;
  playtimeMs: number;
}

export interface KeyValueStore {
  get<T>(key: IDBValidKey): Promise<T | undefined>;
  set(key: IDBValidKey, value: unknown): Promise<void>;
  del(key: IDBValidKey): Promise<void>;
}

const idbStore = createStore(STORAGE_NAMESPACE, 'saves');

const defaultStore: KeyValueStore = {
  get: <T>(key: IDBValidKey) => get<T>(key, idbStore),
  set: (key: IDBValidKey, value: unknown) => set(key, value, idbStore),
  del: (key: IDBValidKey) => del(key, idbStore),
};

function cloneSave(save: SaveGame): SaveGame {
  return structuredClone(save);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`Invalid save data: ${label} must be an object`);
  return value;
}

function assertArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`Invalid save data: ${label} must be an array`);
  return value;
}

function assertString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`Invalid save data: ${label} must be a string`);
  return value;
}

function assertFiniteNumber(value: unknown, label: string, min: number, max = Number.MAX_SAFE_INTEGER): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw new Error(`Invalid save data: ${label} out of range`);
  }
  return value;
}

function assertInteger(value: unknown, label: string, min: number, max = Number.MAX_SAFE_INTEGER): number {
  const number = assertFiniteNumber(value, label, min, max);
  if (!Number.isInteger(number)) throw new Error(`Invalid save data: ${label} must be an integer`);
  return number;
}

function assertBooleanNumberString(value: unknown, label: string): boolean | number | string {
  if (typeof value === 'boolean' || typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  throw new Error(`Invalid save data: ${label} must be boolean, number, or string`);
}

function assertFacing(value: unknown): Facing {
  if (value === 'down' || value === 'up' || value === 'left' || value === 'right') return value;
  throw new Error('Invalid save data: player.facing is unknown');
}

function hasOwnKey(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function getKnownItem(itemId: string, label: string): ItemDefinition {
  const items = ITEMS as Record<string, ItemDefinition>;
  const item = hasOwnKey(items, itemId) ? items[itemId] : undefined;
  if (!item) throw new Error(`Invalid save data: unknown ${label} item ${itemId}`);
  return item;
}

function migrate(raw: unknown): SaveGame {
  if (!isRecord(raw)) throw new Error('Invalid save data');
  const version = Number(raw.saveVersion ?? 0);
  if (version > SAVE_VERSION) throw new Error(`Save version ${version} is newer than this build`);
  if (version !== SAVE_VERSION) throw new Error(`Unsupported save version: ${version}`);
  const candidate = { ...createNewSave(), ...raw, saveVersion: SAVE_VERSION } as unknown;
  return validateSave(candidate);
}

function validateSave(raw: unknown): SaveGame {
  const save = assertRecord(raw, 'root');
  const player = assertRecord(save.player, 'player');
  const mapId = assertString(player.mapId, 'player.mapId');
  if (!hasOwnKey(MAPS as Record<string, unknown>, mapId)) throw new Error(`Invalid save data: unknown player.mapId ${mapId}`);

  const seenInventory = new Set<string>();
  const inventory = assertArray(save.inventory, 'inventory').map((entry, index) => {
    const item = assertRecord(entry, `inventory[${index}]`);
    const itemId = assertString(item.itemId, `inventory[${index}].itemId`);
    const itemDef = getKnownItem(itemId, 'inventory');
    if (seenInventory.has(itemId)) throw new Error(`Invalid save data: duplicate inventory item ${itemId}`);
    seenInventory.add(itemId);
    return { itemId, quantity: assertInteger(item.quantity, `inventory[${index}].quantity`, 1, itemDef.maxStack) };
  });

  const equipment = assertRecord(save.equipment, 'equipment');
  const weapon = equipment.weapon === null ? null : assertString(equipment.weapon, 'equipment.weapon');
  const accessory = equipment.accessory === null ? null : assertString(equipment.accessory, 'equipment.accessory');
  if (weapon !== null) {
    const item = getKnownItem(weapon, 'equipment weapon');
    if (item.category !== 'weapon') throw new Error(`Invalid save data: equipment.weapon must be a weapon`);
    if (!seenInventory.has(weapon)) throw new Error(`Invalid save data: equipment.weapon is not in inventory`);
  }
  if (accessory !== null) {
    const item = getKnownItem(accessory, 'equipment accessory');
    if (item.category !== 'accessory') throw new Error(`Invalid save data: equipment.accessory must be an accessory`);
    if (!seenInventory.has(accessory)) throw new Error(`Invalid save data: equipment.accessory is not in inventory`);
  }

  const quests = assertRecord(save.quests, 'quests');
  const questDefs = QUESTS as Record<string, QuestDefinition>;
  const validatedQuests: SaveGame['quests'] = {};
  for (const [questId, progressRaw] of Object.entries(quests)) {
    const quest = hasOwnKey(questDefs as Record<string, unknown>, questId) ? questDefs[questId] : undefined;
    if (!quest) throw new Error(`Invalid save data: unknown quest ${questId}`);
    const progress = assertRecord(progressRaw, `quests.${questId}`);
    const status = assertString(progress.status, `quests.${questId}.status`);
    if (!['locked', 'available', 'active', 'completed', 'rewarded'].includes(status)) {
      throw new Error(`Invalid save data: unknown quest status ${status}`);
    }
    const objectives = assertRecord(progress.objectives, `quests.${questId}.objectives`);
    validatedQuests[questId] = { status: status as SaveGame['quests'][string]['status'], objectives: {} };
    for (const objective of quest.objectives) {
      const objectiveValue = hasOwnKey(objectives, objective.id) ? objectives[objective.id] : 0;
      validatedQuests[questId].objectives[objective.id] = assertInteger(objectiveValue, `quests.${questId}.objectives.${objective.id}`, 0, objective.count);
    }
  }

  const flags = assertRecord(save.flags, 'flags');
  const validatedFlags: SaveGame['flags'] = {};
  for (const [key, value] of Object.entries(flags)) validatedFlags[key] = assertBooleanNumberString(value, `flags.${key}`);

  const openedChests = assertArray(save.openedChests, 'openedChests').map((id, index) => assertString(id, `openedChests[${index}]`));
  const defeatedBosses = assertArray(save.defeatedBosses, 'defeatedBosses').map((id, index) => {
    const enemyId = assertString(id, `defeatedBosses[${index}]`);
    const enemy = hasOwnKey(ENEMIES as Record<string, unknown>, enemyId) ? ENEMIES[enemyId] : undefined;
    if (!enemy?.boss) throw new Error(`Invalid save data: unknown defeated boss ${enemyId}`);
    return enemyId;
  });

  const maxHp = assertInteger(player.maxHp, 'player.maxHp', 1, 999);
  const hp = assertInteger(player.hp, 'player.hp', 0, maxHp);

  return {
    saveVersion: SAVE_VERSION,
    player: {
      mapId,
      spawnId: assertString(player.spawnId, 'player.spawnId'),
      x: player.x === undefined ? undefined : assertFiniteNumber(player.x, 'player.x', 0, 10000),
      y: player.y === undefined ? undefined : assertFiniteNumber(player.y, 'player.y', 0, 10000),
      facing: assertFacing(player.facing),
      hp,
      maxHp,
      level: assertInteger(player.level, 'player.level', 1, 99),
      xp: assertInteger(player.xp, 'player.xp', 0),
      coins: assertInteger(player.coins, 'player.coins', 0, 999999),
    },
    inventory,
    equipment: { weapon, accessory },
    quests: validatedQuests,
    flags: validatedFlags,
    openedChests,
    defeatedBosses,
    playtimeMs: assertFiniteNumber(save.playtimeMs, 'playtimeMs', 0),
    savedAt: assertFiniteNumber(save.savedAt, 'savedAt', 0),
  };
}

function metaFromSave(save: SaveGame): SaveMeta {
  return {
    savedAt: save.savedAt,
    saveVersion: save.saveVersion,
    level: save.player.level,
    mapId: save.player.mapId,
    playtimeMs: save.playtimeMs,
  };
}

export class SaveSystem {
  private persistenceRequested = false;

  constructor(private readonly store: KeyValueStore = defaultStore) {}

  static validate(raw: unknown): SaveGame {
    return cloneSave(migrate(raw));
  }

  static parseImport(json: string): SaveGame {
    return SaveSystem.validate(JSON.parse(json) as unknown);
  }

  async save(save: SaveGame): Promise<SaveGame> {
    const copy = cloneSave(save);
    copy.savedAt = Date.now();
    copy.saveVersion = SAVE_VERSION;
    await this.store.set(SAVE_SLOT_KEY, copy);
    await this.writeMeta(copy);
    this.requestPersistence();
    return cloneSave(copy);
  }

  async load(): Promise<SaveGame | null> {
    const raw = await this.store.get<unknown>(SAVE_SLOT_KEY);
    if (raw === undefined) return null;
    return migrate(raw);
  }

  async delete(): Promise<void> {
    await this.store.del(SAVE_SLOT_KEY);
    await this.store.del(SAVE_META_KEY);
  }

  async export(): Promise<string> {
    const save = await this.load();
    if (!save) throw new Error('No save to export');
    return JSON.stringify(save);
  }

  async import(json: string): Promise<SaveGame> {
    const save = SaveSystem.parseImport(json);
    return this.save(save);
  }

  parseImport(json: string): SaveGame {
    return SaveSystem.parseImport(json);
  }

  async getMeta(): Promise<SaveMeta | null> {
    try {
      return (await this.store.get<SaveMeta>(SAVE_META_KEY)) ?? null;
    } catch (error) {
      console.warn('[SaveSystem] Save metadata unavailable; falling back to primary save', error);
      const save = await this.load();
      return save ? metaFromSave(save) : null;
    }
  }

  private async writeMeta(save: SaveGame): Promise<void> {
    try {
      await this.store.set(SAVE_META_KEY, metaFromSave(save));
    } catch (error) {
      console.warn('[SaveSystem] Save metadata could not be updated', error);
    }
  }

  /**
   * Asks the browser to keep this origin's storage. Requested once and never awaited: Firefox answers with a
   * permission prompt, and while that prompt is open the promise does not settle. Awaiting it held the save
   * queue, and the door transition that waits on the queue, which softlocked every door in Firefox.
   */
  private requestPersistence(): void {
    if (this.persistenceRequested || typeof navigator === 'undefined' || !navigator.storage?.persist) return;
    this.persistenceRequested = true;
    try {
      navigator.storage.persist().then(
        () => undefined,
        (error: unknown) => console.warn('[SaveSystem] Persistent storage request was rejected', error),
      );
    } catch (error) {
      console.warn('[SaveSystem] Persistent storage request was rejected', error);
    }
  }
}
