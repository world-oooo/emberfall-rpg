import type { MusicId } from './audio';

export interface MapDefinition {
  id: string;
  file: string; // under public/assets/maps
  displayName: string;
  tilesets: readonly string[]; // texture keys == tileset names in the map JSON
  music: MusicId;
  /** enemy ids that spawn here, so their sheets load with the map bundle */
  enemies: readonly string[];
  /** npc ids present */
  npcs: readonly string[];
}

export const MAPS: Record<string, MapDefinition> = {
  village: {
    id: 'village',
    file: 'village.json',
    displayName: 'Kagehara Village',
    tilesets: ['TilesetFloor', 'TilesetFloorDetail', 'TilesetNature', 'TilesetHouse', 'TilesetWater', 'TilesetLogic'],
    music: 'village',
    enemies: [],
    npcs: ['elder_hana', 'master_ryo', 'merchant_botan', 'child_mimi', 'guard_goro', 'villager_woman', 'villager_man'],
  },
  woods: {
    id: 'woods',
    file: 'woods.json',
    displayName: 'Whispering Woods',
    tilesets: ['TilesetFloor', 'TilesetFloorDetail', 'TilesetNature', 'TilesetHouse', 'TilesetWater', 'TilesetRelief', 'TilesetLogic'],
    music: 'woods',
    enemies: ['slime', 'mushroom'],
    npcs: ['hermit_sen'],
  },
  shrine: {
    id: 'shrine',
    file: 'shrine.json',
    displayName: 'Hollow Shrine',
    tilesets: ['TilesetInteriorFloor', 'TilesetWallSimple', 'TilesetInterior', 'TilesetDungeon', 'TilesetWater', 'TilesetElement', 'TilesetLogic'],
    music: 'shrine',
    enemies: ['bat', 'skeleton', 'boss_racoon', 'slime'],
    npcs: [],
  },
};

export function getMapDef(id: string): MapDefinition {
  const def = MAPS[id];
  if (!def) throw new Error(`Unknown map: ${id}`);
  return def;
}
