import { itemId, type ItemId } from '../types/ids';

export type ItemCategory = 'weapon' | 'accessory' | 'consumable' | 'key' | 'quest' | 'currency';

export interface WeaponStats {
  damage: number;
  /** multiplier on attack phase timings (1 = katana baseline) */
  speed: number;
  /** hitbox reach in px from the player's centre */
  reach: number;
  knockback: number;
  /** 3rd hit of the chain multiplies damage by this */
  finisherMultiplier: number;
}

export interface AccessoryStats {
  maxHpBonus?: number;
  rollSpeedMultiplier?: number;
  rollInvulnerableBonusMs?: number;
}

export interface ConsumableEffect {
  heal?: number;
  /** thrown projectile damage (shuriken) */
  throwDamage?: number;
}

export interface ItemDefinition {
  id: ItemId;
  name: string;
  description: string;
  category: ItemCategory;
  /** file name under public/assets/items without extension */
  icon: string;
  maxStack: number;
  value: number;
  weapon?: WeaponStats;
  accessory?: AccessoryStats;
  consumable?: ConsumableEffect;
  tags?: readonly string[];
}

const define = <T extends Record<string, Omit<ItemDefinition, 'id'>>>(defs: T) =>
  Object.fromEntries(Object.entries(defs).map(([id, d]) => [id, { ...d, id: itemId(id) }])) as {
    [K in keyof T]: ItemDefinition;
  };

export const ITEMS = define({
  katana: {
    name: 'Katana',
    description: 'Fast, precise. Three quick cuts.',
    category: 'weapon',
    icon: 'katana',
    maxStack: 1,
    value: 60,
    weapon: { damage: 2, speed: 1, reach: 14, knockback: 90, finisherMultiplier: 1.5 },
  },
  heavy_blade: {
    name: 'Heavy Blade',
    description: 'Slow. Sends things flying.',
    category: 'weapon',
    icon: 'heavy_blade',
    maxStack: 1,
    value: 120,
    weapon: { damage: 4, speed: 1.6, reach: 18, knockback: 180, finisherMultiplier: 1.5 },
  },
  shuriken: {
    name: 'Shuriken',
    description: 'A throwing star. Hits from afar.',
    category: 'consumable',
    icon: 'shuriken',
    maxStack: 20,
    value: 3,
    consumable: { throwDamage: 3 },
  },
  rice_ball: {
    name: 'Rice Ball',
    description: 'Restores 2 hearts.',
    category: 'consumable',
    icon: 'rice_ball',
    maxStack: 10,
    value: 10,
    consumable: { heal: 4 },
  },
  life_potion: {
    name: 'Life Potion',
    description: 'Restores all hearts.',
    category: 'consumable',
    icon: 'life_potion',
    maxStack: 5,
    value: 40,
    consumable: { heal: 99 },
  },
  guardian_charm: {
    name: "Guardian's Charm",
    description: 'A warm stone. +1 heart.',
    category: 'accessory',
    icon: 'gem_red',
    maxStack: 1,
    value: 0,
    accessory: { maxHpBonus: 2 },
  },
  fox_charm: {
    name: 'Fox Charm',
    description: 'Roll faster and further.',
    category: 'accessory',
    icon: 'gem_green',
    maxStack: 1,
    value: 0,
    accessory: { rollSpeedMultiplier: 1.2, rollInvulnerableBonusMs: 60 },
  },
  shrine_key: {
    name: 'Shrine Key',
    description: 'Opens the sealed door in the Hollow Shrine.',
    category: 'key',
    icon: 'gold_key',
    maxStack: 1,
    value: 0,
  },
  ember: {
    name: 'The Ember',
    description: 'It still burns. Bring it home.',
    category: 'quest',
    icon: 'scroll_fire',
    maxStack: 1,
    value: 0,
  },
  broken_mask: {
    name: 'Broken Mask',
    description: 'Half a tengu mask. Someone was here.',
    category: 'quest',
    icon: 'letter',
    maxStack: 1,
    value: 0,
  },
  coin: {
    name: 'Coin',
    description: 'Village currency.',
    category: 'currency',
    icon: 'gold_coin',
    maxStack: 999,
    value: 1,
  },
});

export type KnownItemId = keyof typeof ITEMS;

export function getItem(id: string): ItemDefinition {
  const item = (ITEMS as Record<string, ItemDefinition>)[id];
  if (!item) throw new Error(`Unknown item: ${id}`);
  return item;
}

export function hasItemDef(id: string): boolean {
  return id in ITEMS;
}
