/**
 * Tiled-compatible JSON map builder (Tiled ≥ 1.10 schema, orthogonal, CSV data, embedded tilesets).
 * Runs on Node (`node --experimental-strip-types`). Output stays editable in Tiled.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(HERE, '..', '..', '..');
const TILES_DIR = join(ROOT, 'public', 'assets', 'tiles');
export const MAPS_DIR = join(ROOT, 'public', 'assets', 'maps');

export const TILE = 16;
const EXTRUDE = 1;

// ---------- PNG header read (no deps) ----------
function pngSize(path: string): { width: number; height: number } {
  const buf = readFileSync(path);
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error(`Not a PNG: ${path}`);
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

// ---------- terrain tables ----------
export interface TerrainDef {
  tileset: string;
  /** edge: 8-bit neighbour masks on the cell grid; corner: 4-bit masks on the dual (corner) grid */
  mode: 'edge' | 'corner';
  masks: Record<string, number>;
  fullVariants: number[];
  plainVariants: number[];
}
export const TERRAINS: Record<string, TerrainDef> = JSON.parse(
  readFileSync(join(HERE, '..', 'data', 'terrains.json'), 'utf8'),
) as Record<string, TerrainDef>;

// ---------- deterministic rng ----------
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Property = { name: string; type: 'string' | 'int' | 'float' | 'bool'; value: string | number | boolean };

export function props(obj: Record<string, string | number | boolean | undefined>): Property[] {
  const out: Property[] = [];
  for (const [name, value] of Object.entries(obj)) {
    if (value === undefined) continue;
    const type = typeof value === 'boolean' ? 'bool' : typeof value === 'number' ? (Number.isInteger(value) ? 'int' : 'float') : 'string';
    out.push({ name, type, value });
  }
  return out;
}

interface TilesetEntry {
  name: string;
  firstgid: number;
  columns: number;
  rows: number;
  imagewidth: number;
  imageheight: number;
  tiles: Map<number, Property[]>;
}

export class TileLayer {
  readonly data: Uint32Array;
  /** pixel offset of the whole layer (Tiled offsetx/offsety); dual-grid layers use -8,-8 */
  offsetX = 0;
  offsetY = 0;
  constructor(
    readonly name: string,
    readonly width: number,
    readonly height: number,
    readonly visible = true,
    readonly opacity = 1,
  ) {
    this.data = new Uint32Array(width * height);
  }
  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }
  set(x: number, y: number, gid: number): void {
    if (!this.inBounds(x, y)) return;
    this.data[y * this.width + x] = gid;
  }
  get(x: number, y: number): number {
    if (!this.inBounds(x, y)) return 0;
    return this.data[y * this.width + x] ?? 0;
  }
  fillRect(x: number, y: number, w: number, h: number, gid: number): void {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, gid);
  }
}

export interface MapObject {
  type: string;
  name?: string;
  x: number; // px
  y: number; // px
  width?: number;
  height?: number;
  properties?: Record<string, string | number | boolean | undefined>;
}

export class ObjectLayer {
  readonly objects: MapObject[] = [];
  constructor(readonly name: string) {}
  add(o: MapObject): this {
    this.objects.push(o);
    return this;
  }
}

export interface MapMeta {
  id: string;
  displayName: string;
  music?: string;
  ambient?: string;
  tint?: string;
  width: number;
  height: number;
  seed?: number;
}

export class MapBuilder {
  private readonly tilesets: TilesetEntry[] = [];
  private readonly tileLayers: TileLayer[] = [];
  private readonly objectLayers: ObjectLayer[] = [];
  private nextGid = 1;
  readonly random: () => number;
  readonly width: number;
  readonly height: number;

  constructor(readonly meta: MapMeta) {
    this.width = meta.width;
    this.height = meta.height;
    this.random = rng(meta.seed ?? 1337);
  }

  /** Register a tileset (extruded png in public/assets/tiles). Order defines firstgid ranges. */
  tileset(name: string): this {
    if (this.tilesets.some((t) => t.name === name)) return this;
    const { width, height } = pngSize(join(TILES_DIR, `${name}.png`));
    const cell = TILE + EXTRUDE * 2;
    const columns = Math.floor(width / cell);
    const rows = Math.floor(height / cell);
    this.tilesets.push({ name, firstgid: this.nextGid, columns, rows, imagewidth: width, imageheight: height, tiles: new Map() });
    this.nextGid += columns * rows;
    return this;
  }

  /** Global id for a local tile index of a registered tileset. */
  gid(tileset: string, local: number): number {
    const ts = this.tilesets.find((t) => t.name === tileset);
    if (!ts) throw new Error(`Tileset not registered: ${tileset}`);
    if (local < 0 || local >= ts.columns * ts.rows) throw new Error(`Tile ${local} out of range for ${tileset}`);
    return ts.firstgid + local;
  }

  tileProps(tileset: string, local: number, p: Record<string, string | number | boolean>): void {
    const ts = this.tilesets.find((t) => t.name === tileset);
    if (!ts) throw new Error(`Tileset not registered: ${tileset}`);
    ts.tiles.set(local, props(p));
  }

  layer(name: string, opts: { visible?: boolean; opacity?: number; offsetX?: number; offsetY?: number } = {}): TileLayer {
    let l = this.tileLayers.find((t) => t.name === name);
    if (!l) {
      l = new TileLayer(name, this.width, this.height, opts.visible ?? true, opts.opacity ?? 1);
      l.offsetX = opts.offsetX ?? 0;
      l.offsetY = opts.offsetY ?? 0;
      this.tileLayers.push(l);
    }
    return l;
  }

  objects(name: string): ObjectLayer {
    let l = this.objectLayers.find((t) => t.name === name);
    if (!l) {
      l = new ObjectLayer(name);
      this.objectLayers.push(l);
    }
    return l;
  }

  // ---------- painting helpers ----------

  /** Fill a rect with random plain variants of a terrain's outer material. */
  fillPlain(layer: TileLayer, terrainId: string, x = 0, y = 0, w = this.width, h = this.height): void {
    const t = TERRAINS[terrainId];
    if (!t) throw new Error(`Unknown terrain ${terrainId}`);
    for (let j = y; j < y + h; j++)
      for (let i = x; i < x + w; i++) layer.set(i, j, this.gid(t.tileset, this.pick(t.plainVariants)));
  }

  /**
   * Autotile a boolean grid: cells marked true become the terrain's inner material with correct edges.
   * Out-of-bounds counts as inner so borders never show edge tiles.
   */
  paintTerrain(layer: TileLayer, grid: boolean[][], terrainId: string): void {
    const t = TERRAINS[terrainId];
    if (!t) throw new Error(`Unknown terrain ${terrainId}`);
    if (t.mode === 'corner') {
      this.paintCornerTerrain(layer, grid, t);
      return;
    }
    const at = (x: number, y: number): boolean => {
      if (y < 0 || y >= grid.length) return true;
      const row = grid[y];
      if (!row || x < 0 || x >= row.length) return true;
      return row[x] ?? false;
    };
    for (let y = 0; y < grid.length; y++) {
      for (let x = 0; x < (grid[y]?.length ?? 0); x++) {
        if (!at(x, y)) continue;
        const n = at(x, y - 1);
        const e = at(x + 1, y);
        const s = at(x, y + 1);
        const w = at(x - 1, y);
        const ne = n && e && at(x + 1, y - 1);
        const se = s && e && at(x + 1, y + 1);
        const sw = s && w && at(x - 1, y + 1);
        const nw = n && w && at(x - 1, y - 1);
        let mask = (n ? 1 : 0) | (ne ? 2 : 0) | (e ? 4 : 0) | (se ? 8 : 0) | (s ? 16 : 0) | (sw ? 32 : 0) | (w ? 64 : 0) | (nw ? 128 : 0);
        let local = t.masks[String(mask)];
        if (local === undefined) {
          // drop corners, then fall back to full
          mask &= 1 | 4 | 16 | 64;
          local = t.masks[String(mask)];
        }
        if (local === undefined) local = t.fullVariants[0] ?? 0;
        if (mask === 255 && t.fullVariants.length > 1 && this.random() < 0.15) local = this.pick(t.fullVariants);
        layer.set(x, y, this.gid(t.tileset, local));
      }
    }
  }

  /**
   * Dual-grid painter: display tile (x, y) sits on the corner shared by cells (x-1,y-1),(x,y-1),(x-1,y),(x,y).
   * The layer must carry offset -8,-8 so cell (x, y) of the grid lines up with the map cell (see SceneMap.water).
   * Out-of-bounds cells count as outer material.
   */
  private paintCornerTerrain(layer: TileLayer, grid: boolean[][], t: TerrainDef): void {
    const at = (x: number, y: number): boolean => grid[y]?.[x] ?? false;
    for (let y = 0; y <= grid.length; y++) {
      for (let x = 0; x <= (grid[0]?.length ?? 0); x++) {
        const nw = at(x - 1, y - 1);
        const ne = at(x, y - 1);
        const sw = at(x - 1, y);
        const se = at(x, y);
        const mask = (nw ? 1 : 0) | (ne ? 2 : 0) | (sw ? 4 : 0) | (se ? 8 : 0);
        if (mask === 0) continue;
        let local = t.masks[String(mask)];
        if (local === undefined) local = t.fullVariants[0] ?? 0;
        layer.set(x, y, this.gid(t.tileset, local));
      }
    }
  }

  /** Stamp a block of local tile indices (row-major, -1 = skip) from a tileset at tile position (x, y). */
  stamp(layer: TileLayer, tileset: string, x: number, y: number, block: number[][]): void {
    for (let j = 0; j < block.length; j++) {
      const row = block[j] ?? [];
      for (let i = 0; i < row.length; i++) {
        const local = row[i];
        if (local === undefined || local < 0) continue;
        layer.set(x + i, y + j, this.gid(tileset, local));
      }
    }
  }

  pick<T>(arr: T[]): T {
    const v = arr[Math.floor(this.random() * arr.length)];
    if (v === undefined) throw new Error('pick from empty array');
    return v;
  }

  // ---------- output ----------

  build(): Record<string, unknown> {
    let layerId = 1;
    const layers: unknown[] = [];
    for (const l of this.tileLayers) {
      layers.push({
        id: layerId++,
        name: l.name,
        type: 'tilelayer',
        width: l.width,
        height: l.height,
        x: 0,
        y: 0,
        visible: l.visible,
        opacity: l.opacity,
        offsetx: l.offsetX,
        offsety: l.offsetY,
        encoding: 'csv',
        data: Array.from(l.data),
      });
    }
    let objectId = 1;
    for (const l of this.objectLayers) {
      layers.push({
        id: layerId++,
        name: l.name,
        type: 'objectgroup',
        draworder: 'topdown',
        visible: true,
        opacity: 1,
        x: 0,
        y: 0,
        objects: l.objects.map((o) => ({
          id: objectId++,
          name: o.name ?? '',
          type: o.type,
          x: o.x,
          y: o.y,
          width: o.width ?? 0,
          height: o.height ?? 0,
          rotation: 0,
          visible: true,
          ...(o.width === undefined && o.height === undefined ? { point: true } : {}),
          properties: props(o.properties ?? {}),
        })),
      });
    }
    return {
      type: 'map',
      version: '1.10',
      tiledversion: '1.12.2',
      orientation: 'orthogonal',
      renderorder: 'right-down',
      infinite: false,
      compressionlevel: -1,
      width: this.width,
      height: this.height,
      tilewidth: TILE,
      tileheight: TILE,
      nextlayerid: layerId,
      nextobjectid: objectId,
      properties: props({
        mapId: this.meta.id,
        displayName: this.meta.displayName,
        music: this.meta.music,
        ambient: this.meta.ambient,
        tint: this.meta.tint,
      }),
      tilesets: this.tilesets.map((t) => ({
        firstgid: t.firstgid,
        name: t.name,
        image: `../tiles/${t.name}.png`,
        imagewidth: t.imagewidth,
        imageheight: t.imageheight,
        tilewidth: TILE,
        tileheight: TILE,
        margin: EXTRUDE,
        spacing: EXTRUDE * 2,
        columns: t.columns,
        tilecount: t.columns * t.rows,
        tiles: Array.from(t.tiles.entries()).map(([id, properties]) => ({ id, properties })),
      })),
      layers,
    };
  }

  write(): string {
    mkdirSync(MAPS_DIR, { recursive: true });
    const file = join(MAPS_DIR, `${this.meta.id}.json`);
    writeFileSync(file, JSON.stringify(this.build()));
    return file;
  }
}

/** Boolean grid helpers. */
export function grid(width: number, height: number, fill = false): boolean[][] {
  return Array.from({ length: height }, () => Array.from({ length: width }, () => fill));
}
export function rect(g: boolean[][], x: number, y: number, w: number, h: number, v = true): void {
  for (let j = y; j < y + h; j++) {
    const row = g[j];
    if (!row) continue;
    for (let i = x; i < x + w; i++) if (i >= 0 && i < row.length) row[i] = v;
  }
}
export function ellipse(g: boolean[][], cx: number, cy: number, rx: number, ry: number, v = true): void {
  for (let j = Math.floor(cy - ry); j <= Math.ceil(cy + ry); j++) {
    const row = g[j];
    if (!row) continue;
    for (let i = Math.floor(cx - rx); i <= Math.ceil(cx + rx); i++) {
      if (i < 0 || i >= row.length) continue;
      const dx = (i + 0.5 - cx) / rx;
      const dy = (j + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1) row[i] = v;
    }
  }
}
/** Thick polyline path (for roads). Points in tile coords. */
export function path(g: boolean[][], points: [number, number][], thickness = 2, v = true): void {
  for (let k = 0; k + 1 < points.length; k++) {
    const [x0, y0] = points[k]!;
    const [x1, y1] = points[k + 1]!;
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let s = 0; s <= steps; s++) {
      const x = Math.round(x0 + ((x1 - x0) * s) / steps);
      const y = Math.round(y0 + ((y1 - y0) * s) / steps);
      rect(g, x - Math.floor((thickness - 1) / 2), y - Math.floor((thickness - 1) / 2), thickness, thickness, v);
    }
  }
}
