import { getItem, ITEMS, type ItemDefinition, type WeaponStats } from './items';

export interface WeaponDefinition extends ItemDefinition {
  weapon: WeaponStats;
}

export const WEAPON_IDS = ['katana', 'heavy_blade'] as const;
export type WeaponId = (typeof WEAPON_IDS)[number];

export function getWeapon(id: string): WeaponDefinition {
  const item = getItem(id);
  if (!item.weapon) throw new Error(`Item is not a weapon: ${id}`);
  return item as WeaponDefinition;
}

export function isWeaponId(id: string): id is WeaponId {
  return id in ITEMS && Boolean(getItem(id).weapon);
}
