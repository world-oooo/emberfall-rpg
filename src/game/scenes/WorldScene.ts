import Phaser from 'phaser';
import { ASSET_ROOT, enemyTexture, mapKey, musicKey, npcTexture } from '../config/assets';
import { getMapDef, type MapDefinition } from '../data/maps';
import { getSession, type GameSession } from '../core/session';
import { InputActions } from '../input/InputActions';
import { CameraFollow } from '../core/CameraFollow';
import { Player } from '../entities/player/Player';
import { findObjects, findSpawn, loadTiledMap, propStr, type LoadedMap } from '../world/MapLoader';
import { Npc } from '../entities/npcs/Npc';
import type { Facing } from '../entities/player/heroAnimations';
import { DebugOverlay } from '../debug/DebugOverlay';
import { MapTransitionSystem } from '../systems/MapTransitionSystem';
import type { UIScene } from './UIScene';

export interface WorldSceneData {
  mapId: string;
  spawnId: string;
}

/** One scene for every map: restarted with a new mapId/spawnId on transitions. */
export class WorldScene extends Phaser.Scene {
  mapDef!: MapDefinition;
  session!: GameSession;
  loaded!: LoadedMap;
  player!: Player;
  inputActions!: InputActions;
  cameraFollow!: CameraFollow;
  readonly npcs: Npc[] = [];
  transitions!: MapTransitionSystem;
  private spawnId = 'start';
  private debug: DebugOverlay | null = null;

  constructor() {
    super('WorldScene');
  }

  init(data: Partial<WorldSceneData>): void {
    this.session = getSession();
    const target = this.session.pendingSpawn ?? { mapId: data.mapId ?? this.session.save.player.mapId, spawnId: data.spawnId ?? this.session.save.player.spawnId };
    this.session.pendingSpawn = null;
    this.mapDef = getMapDef(target.mapId);
    this.spawnId = target.spawnId;
  }

  preload(): void {
    this.load.setPath(ASSET_ROOT);
    const def = this.mapDef;
    if (!this.cache.tilemap.exists(mapKey(def.id))) this.load.tilemapTiledJSON(mapKey(def.id), `maps/${def.file}`);
    for (const ts of def.tilesets) {
      if (!this.textures.exists(ts)) this.load.image(ts, `tiles/${ts}.png`);
    }
    for (const npc of def.npcs) {
      if (!this.textures.exists(npcTexture(npc))) this.load.spritesheet(npcTexture(npc), `characters/npcs/${npc}.png`, { frameWidth: 16, frameHeight: 16 });
    }
    for (const enemy of def.enemies) {
      // enemy sheets are 16x16 grids for monsters (64x64) — boss sheets are registered by the enemy data (M4+)
      if (enemy.startsWith('boss_')) continue;
      if (!this.textures.exists(enemyTexture(enemy))) this.load.spritesheet(enemyTexture(enemy), `enemies/${enemy}.png`, { frameWidth: 16, frameHeight: 16 });
    }
    if (!this.cache.audio.exists(musicKey(def.music))) this.load.audio(musicKey(def.music), `audio/music/${def.music}.ogg`);
  }

  create(): void {
    this.loaded = loadTiledMap(this, mapKey(this.mapDef.id), this.mapDef.tilesets);
    this.physics.world.setBounds(0, 0, this.loaded.widthPx, this.loaded.heightPx);
    this.cameras.main.setBounds(0, 0, this.loaded.widthPx, this.loaded.heightPx);
    this.cameras.main.setRoundPixels(true);

    this.inputActions = new InputActions(this);

    const spawn = findSpawn(this.loaded, this.spawnId);
    const sx = spawn ? Math.round(spawn.x) : this.loaded.widthPx / 2;
    const sy = spawn ? Math.round(spawn.y) : this.loaded.heightPx / 2;
    const facing = (spawn ? propStr(spawn, 'facing', 'down') : 'down') as Facing;
    this.player = new Player(this, sx, sy - 12, { facing });
    this.player.input = this.inputActions;
    if (this.loaded.collision) this.physics.add.collider(this.player.sprite, this.loaded.collision);

    this.npcs.length = 0;
    for (const o of findObjects(this.loaded, 'NPCs', 'NPC')) {
      const npc = new Npc(this, { npcId: propStr(o, 'npcId'), facing: propStr(o, 'facing', 'down') as Facing, x: Math.round(o.x), y: Math.round(o.y) - 8 });
      this.npcs.push(npc);
      this.physics.add.collider(this.player.sprite, npc.sprite);
    }

    this.transitions = new MapTransitionSystem(this);

    this.cameraFollow = new CameraFollow(this.cameras.main, this.player.sprite);
    this.cameraFollow.snap();
    this.cameraFollow.update(0);
    this.cameras.main.fadeIn(350, 0, 0, 0);

    if (!this.scene.isActive('UIScene')) this.scene.launch('UIScene');
    this.scene.bringToTop('UIScene');
    this.ui?.showMapName(this.mapDef.displayName);

    if (import.meta.env.DEV && new URLSearchParams(location.search).has('debug')) {
      this.debug = new DebugOverlay(this);
    }

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.transitions.destroy();
      this.npcs.length = 0;
      this.inputActions.destroy();
      this.debug?.destroy();
      this.debug = null;
    });
  }

  get ui(): UIScene | null {
    const s = this.scene.get('UIScene') as UIScene | null;
    return s && this.scene.isActive('UIScene') ? s : null;
  }

  hasItem(itemId: string): boolean {
    return this.session.save.inventory.some((e) => e.itemId === itemId && e.quantity > 0);
  }

  showHint(text: string): void {
    this.ui?.showToast(text);
  }

  override update(time: number, delta: number): void {
    this.inputActions.update(time);
    this.player.update(delta);
    // camera + depth after physics step (physics runs in the scene's preupdate/update via world step)
    this.player.postUpdate();
    for (const n of this.npcs) n.syncDepth();
    this.cameraFollow.update(delta);
    this.debug?.update();
  }
}
