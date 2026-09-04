import Phaser from 'phaser';
import { Depth } from '../config/constants';

export interface TiledProperty {
  name: string;
  type: string;
  value: string | number | boolean;
}

export interface TiledObject {
  id: number;
  name: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  point?: boolean;
  properties?: TiledProperty[];
}

/** Read a custom property off a Tiled object (properties stay an array in Phaser's parser). */
export function prop<T extends string | number | boolean>(obj: { properties?: TiledProperty[] } | undefined, name: string): T | undefined {
  const p = obj?.properties?.find((q) => q.name === name);
  return p ? (p.value as T) : undefined;
}

export function propStr(obj: { properties?: TiledProperty[] } | undefined, name: string, fallback = ''): string {
  const v = prop<string>(obj, name);
  return v === undefined ? fallback : String(v);
}

export function propBool(obj: { properties?: TiledProperty[] } | undefined, name: string, fallback = false): boolean {
  const v = prop<boolean>(obj, name);
  return v === undefined ? fallback : Boolean(v);
}

export function propNum(obj: { properties?: TiledProperty[] } | undefined, name: string, fallback = 0): number {
  const v = prop<number>(obj, name);
  return v === undefined ? fallback : Number(v);
}

export interface LoadedMap {
  map: Phaser.Tilemaps.Tilemap;
  layers: Record<string, Phaser.Tilemaps.TilemapLayer>;
  collision: Phaser.Tilemaps.TilemapLayer | null;
  widthPx: number;
  heightPx: number;
  objects: Record<string, TiledObject[]>;
  properties: Record<string, string | number | boolean>;
}

const LAYER_DEPTH: Record<string, number> = {
  Ground: Depth.Ground,
  Water: Depth.Ground + 0.5,
  GroundDetail: Depth.GroundDetail,
  BelowPlayer: Depth.BelowPlayer,
  AbovePlayer: Depth.AbovePlayer,
  Foreground: Depth.Foreground,
};

/** Builds tile layers with fixed depths, sets collision from the `Collision` layer, exposes object layers by name. */
export function loadTiledMap(scene: Phaser.Scene, key: string, tilesetNames: readonly string[]): LoadedMap {
  const map = scene.make.tilemap({ key });
  const tilesets: Phaser.Tilemaps.Tileset[] = [];
  for (const name of tilesetNames) {
    const ts = map.addTilesetImage(name, name);
    if (ts) tilesets.push(ts);
    else console.warn(`[MapLoader] tileset "${name}" not found in map "${key}"`);
  }

  const layers: Record<string, Phaser.Tilemaps.TilemapLayer> = {};
  let collision: Phaser.Tilemaps.TilemapLayer | null = null;
  for (const layerData of map.layers) {
    const name = layerData.name;
    const layer = map.createLayer(name, tilesets, 0, 0) as Phaser.Tilemaps.TilemapLayer | null;
    if (!layer) continue;
    if (name === 'Collision') {
      layer.setVisible(false);
      layer.setCollisionByExclusion([-1]);
      collision = layer;
      continue;
    }
    layer.setDepth(LAYER_DEPTH[name] ?? Depth.Ground);
    layers[name] = layer;
  }

  const objects: Record<string, TiledObject[]> = {};
  for (const objLayer of map.objects) {
    objects[objLayer.name] = objLayer.objects as unknown as TiledObject[];
  }

  const properties: Record<string, string | number | boolean> = {};
  const rawProps = map.properties as unknown;
  if (Array.isArray(rawProps)) {
    for (const p of rawProps as TiledProperty[]) properties[p.name] = p.value;
  } else if (rawProps && typeof rawProps === 'object') {
    Object.assign(properties, rawProps as Record<string, string | number | boolean>);
  }

  return {
    map,
    layers,
    collision,
    widthPx: map.widthInPixels,
    heightPx: map.heightInPixels,
    objects,
    properties,
  };
}

export function findObjects(loaded: LoadedMap, layer: string, type?: string): TiledObject[] {
  const list = loaded.objects[layer] ?? [];
  return type ? list.filter((o) => o.type === type) : list;
}

export function findSpawn(loaded: LoadedMap, spawnId: string): TiledObject | undefined {
  const spawns = findObjects(loaded, 'Spawns', 'PlayerSpawn');
  return spawns.find((s) => propStr(s, 'spawnId') === spawnId) ?? spawns[0];
}
