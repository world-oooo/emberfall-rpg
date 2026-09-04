/** Higher-level authoring helpers on top of MapBuilder: standard layers, props with collision, objects. */
import { MapBuilder, TILE, type MapMeta, type TileLayer } from './builder.ts';
import { PROPS, type PropDef } from './props.ts';

export class SceneMap {
  readonly b: MapBuilder;
  readonly ground: TileLayer;
  /** dual-grid water layer, offset by half a tile so painted cells line up with collision cells */
  readonly water: TileLayer;
  readonly groundDetail: TileLayer;
  readonly below: TileLayer;
  readonly above: TileLayer;
  readonly collision: TileLayer;
  private readonly solidGid: number;

  constructor(meta: MapMeta, tilesets: string[]) {
    this.b = new MapBuilder(meta);
    for (const t of tilesets) this.b.tileset(t);
    this.b.tileset('TilesetLogic');
    // layer creation order = render order in Tiled; runtime assigns fixed depths by name
    this.ground = this.b.layer('Ground');
    this.water = this.b.layer('Water', { offsetX: -8, offsetY: -8 });
    this.groundDetail = this.b.layer('GroundDetail');
    this.below = this.b.layer('BelowPlayer');
    this.above = this.b.layer('AbovePlayer');
    this.collision = this.b.layer('Collision', { visible: false });
    this.solidGid = this.b.gid('TilesetLogic', 4); // red block
  }

  get width(): number {
    return this.b.width;
  }
  get height(): number {
    return this.b.height;
  }

  solid(x: number, y: number, w = 1, h = 1): void {
    this.collision.fillRect(x, y, w, h, this.solidGid);
  }

  clearSolid(x: number, y: number, w = 1, h = 1): void {
    this.collision.fillRect(x, y, w, h, 0);
  }

  isSolid(x: number, y: number): boolean {
    return this.collision.get(x, y) !== 0;
  }

  /** Paint water (or other corner-mode terrain) from a boolean grid and make those cells solid. */
  paintWater(grid: boolean[][], terrainId = 'water_on_grass'): void {
    this.b.paintTerrain(this.water, grid, terrainId);
    for (let y = 0; y < grid.length; y++) for (let x = 0; x < (grid[y]?.length ?? 0); x++) if (grid[y]?.[x]) this.solid(x, y);
  }

  /** Place a prop with its top-left at tile (x, y). Returns its footprint. */
  prop(name: string, x: number, y: number): { x: number; y: number; w: number; h: number } {
    const def = PROPS[name];
    if (!def) throw new Error(`Unknown prop ${name}`);
    return this.placeProp(def, x, y);
  }

  placeProp(def: PropDef, x: number, y: number): { x: number; y: number; w: number; h: number } {
    let row = y;
    for (const r of def.above) {
      this.b.stamp(this.above, def.tileset, x, row, [r]);
      row++;
    }
    for (let j = 0; j < def.below.length; j++) {
      const r = def.below[j] ?? [];
      this.b.stamp(this.below, def.tileset, x, row, [r]);
      const s = def.solid[j] ?? [];
      for (let i = 0; i < s.length; i++) if (s[i]) this.solid(x + i, row);
      row++;
    }
    const w = Math.max(0, ...[...def.above, ...def.below].map((r) => r.length));
    return { x, y, w, h: row - y };
  }

  /** Wall of a tileset tile (e.g. stone wall) — one tile per cell, solid. */
  wallRect(tileset: string, local: number, x: number, y: number, w: number, h: number): void {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.below.set(i, j, this.b.gid(tileset, local));
    this.solid(x, y, w, h);
  }

  /** Border of solid trees around the map edge (keeps the player inside without invisible walls). */
  treeBorder(kinds: string[], thickness = 2, skip: (x: number, y: number) => boolean = () => false): void {
    const w = this.width;
    const h = this.height;
    for (let y = 0; y < h; y += 2) {
      for (let x = 0; x < w; x += 2) {
        const onEdge = x < thickness * 2 || y < thickness * 2 || x >= w - thickness * 2 || y >= h - thickness * 2;
        if (!onEdge || skip(x, y)) continue;
        const jitter = this.b.random() < 0.15;
        if (jitter && !(x < 2 || y < 2 || x >= w - 2 || y >= h - 2)) continue;
        this.prop(this.b.pick(kinds), x, y);
      }
    }
  }

  // ---------- objects ----------

  spawn(spawnId: string, tx: number, ty: number, facing: 'down' | 'up' | 'left' | 'right' = 'down'): void {
    this.b.objects('Spawns').add({ type: 'PlayerSpawn', name: spawnId, x: tx * TILE + TILE / 2, y: ty * TILE + TILE, properties: { spawnId, facing } });
  }

  npc(npcId: string, tx: number, ty: number, facing: 'down' | 'up' | 'left' | 'right' = 'down', extra: Record<string, string | number | boolean> = {}): void {
    this.b.objects('NPCs').add({ type: 'NPC', name: npcId, x: tx * TILE + TILE / 2, y: ty * TILE + TILE, properties: { npcId, facing, ...extra } });
    this.solid(tx, ty);
  }

  enemy(enemyId: string, tx: number, ty: number, spawnId: string, respawn: 'always' | 'once' | 'never' = 'always', extra: Record<string, string | number | boolean> = {}): void {
    this.b.objects('Enemies').add({ type: 'EnemySpawn', name: spawnId, x: tx * TILE + TILE / 2, y: ty * TILE + TILE, properties: { enemyId, spawnId, respawn, ...extra } });
  }

  door(tx: number, ty: number, w: number, h: number, destinationMap: string, destinationSpawn: string, extra: Record<string, string | number | boolean> = {}): void {
    this.b.objects('Doors').add({ type: 'Door', name: `${destinationMap}:${destinationSpawn}`, x: tx * TILE, y: ty * TILE, width: w * TILE, height: h * TILE, properties: { destinationMap, destinationSpawn, ...extra } });
  }

  chest(chestId: string, tx: number, ty: number, lootTable: string, big = false): void {
    this.b.objects('Chests').add({ type: 'Chest', name: chestId, x: tx * TILE + TILE / 2, y: ty * TILE + TILE, properties: { chestId, lootTable, big } });
    this.solid(tx, ty);
  }

  sign(interactionId: string, tx: number, ty: number, text: string): void {
    this.b.objects('Interactables').add({ type: 'Sign', name: interactionId, x: tx * TILE + TILE / 2, y: ty * TILE + TILE, properties: { interactionId, text } });
  }

  interactable(type: string, interactionId: string, tx: number, ty: number, extra: Record<string, string | number | boolean> = {}): void {
    this.b.objects('Interactables').add({ type, name: interactionId, x: tx * TILE + TILE / 2, y: ty * TILE + TILE, properties: { interactionId, ...extra } });
  }

  trigger(questId: string, objectiveId: string, tx: number, ty: number, w: number, h: number, once = true): void {
    this.b.objects('Triggers').add({ type: 'QuestTrigger', name: `${questId}/${objectiveId}`, x: tx * TILE, y: ty * TILE, width: w * TILE, height: h * TILE, properties: { questId, objectiveId, once } });
  }

  cameraBounds(name: string, tx: number, ty: number, w: number, h: number): void {
    this.b.objects('Camera').add({ type: 'CameraBounds', name, x: tx * TILE, y: ty * TILE, width: w * TILE, height: h * TILE, properties: { name } });
  }

  write(): string {
    return this.b.write();
  }
}
