import Phaser from 'phaser';
import { CombatSystem } from '../combat/CombatSystem';
import { ASSET_ROOT, Tex, enemyTexture, mapKey, musicKey, npcTexture } from '../config/assets';
import { Depth, Feel } from '../config/constants';
import { CameraFollow } from '../core/CameraFollow';
import { Display } from '../systems/DisplaySystem';
import { gameEvents } from '../core/events';
import { endSession, getSession, type GameSession, type InventoryEntry } from '../core/session';
import { getDialogue, hasDialogue, type DialogueNode, type DialogueOption } from '../data/dialogue';
import { getEnemy } from '../data/enemies';
import { getItem } from '../data/items';
import { rollLoot } from '../data/loot';
import { getMapDef, type MapDefinition, MAPS } from '../data/maps';
import { getQuest } from '../data/quests';
import { DebugOverlay } from '../debug/DebugOverlay';
import type { BaseEnemy } from '../entities/enemies/BaseEnemy';
import { Npc } from '../entities/npcs/Npc';
import { BossEnemy } from '../entities/enemies/BossEnemy';
import { Player } from '../entities/player/Player';
import type { Facing } from '../entities/player/heroAnimations';
import { createMapInteractables, createNpcInteractable } from '../entities/props/createInteractables';
import type { Interactable, InteractableKind } from '../entities/props/Interactable';
import { InputActions } from '../input/InputActions';
import { AudioSystem } from '../systems/AudioSystem';
import { InteractionSystem } from '../systems/InteractionSystem';
import { InventorySystem } from '../systems/InventorySystem';
import { MapTransitionSystem } from '../systems/MapTransitionSystem';
import { ProgressionSystem, attackBonusForLevel } from '../systems/ProgressionSystem';
import { QuestSystem, type QuestUpdate } from '../systems/QuestSystem';
import { SaveSystem } from '../systems/SaveSystem';
import { SettingsStore } from '../systems/SettingsStore';
import { dialogueId } from '../types/ids';
import { findObjects, findSpawn, loadTiledMap, propStr, type LoadedMap, propNum, type TiledObject } from '../world/MapLoader';
import type { UIScene } from './UIScene';

export interface WorldSceneData {
  mapId: string;
  spawnId: string;
  resume: boolean;
}

/** One scene for every map. It owns the live combat, interaction, quest and save glue for that map. */
export class WorldScene extends Phaser.Scene {
  mapDef!: MapDefinition;
  session!: GameSession;
  loaded!: LoadedMap;
  player!: Player;
  inputActions!: InputActions;
  cameraFollow!: CameraFollow;
  private displayUnsubscribe: (() => void) | null = null;
  private readonly cameraZones: Phaser.Geom.Rectangle[] = [];
  private cameraZoneActive = false;
  combat!: CombatSystem;
  interactions!: InteractionSystem;
  inventory!: InventorySystem;
  quests!: QuestSystem;
  progression!: ProgressionSystem;
  audio!: AudioSystem;
  readonly npcs: Npc[] = [];
  transitions!: MapTransitionSystem;
  private spawnId = 'start';
  private resumePosition = false;
  private debug: DebugOverlay | null = null;
  private gameOver = false;
  private bossMusicActive = false;
  private shrineLit = false;
  private readonly saveSystem = new SaveSystem();
  private saveQueue: Promise<boolean> = Promise.resolve(true);
  private readonly unsubscribers: Array<() => void> = [];

  constructor() {
    super('WorldScene');
  }

  init(data: Partial<WorldSceneData>): void {
    this.session = getSession();
    const target = this.session.pendingSpawn ?? {
      mapId: data.mapId ?? this.session.save.player.mapId,
      spawnId: data.spawnId ?? this.session.save.player.spawnId,
    };
    this.session.pendingSpawn = null;
    this.mapDef = getMapDef(target.mapId);
    this.spawnId = target.spawnId;
    this.resumePosition = Boolean(data.resume && this.session.save.player.mapId === target.mapId);
    this.gameOver = false;
    this.bossMusicActive = false;
  }

  preload(): void {
    this.load.setPath(ASSET_ROOT);
    const def = this.mapDef;
    if (!this.cache.tilemap.exists(mapKey(def.id))) this.load.tilemapTiledJSON(mapKey(def.id), `maps/${def.file}`);
    for (const tileset of def.tilesets) if (!this.textures.exists(tileset)) this.load.image(tileset, `tiles/${tileset}.png`);
    for (const npc of def.npcs) {
      if (!this.textures.exists(npcTexture(npc))) this.load.spritesheet(npcTexture(npc), `characters/npcs/${npc}.png`, { frameWidth: 16, frameHeight: 16 });
      const portrait = `${npc}_face`;
      if (!this.textures.exists(portrait)) this.load.image(portrait, `characters/npcs/${portrait}.png`);
    }
    for (const enemy of def.enemies) {
      if (this.textures.exists(enemyTexture(enemy))) continue;
      if (enemy === 'boss_racoon') {
        // The boss has four separate 60x60 sheets rather than one grid.
        for (const clip of ['idle', 'charge', 'attack', 'jump'] as const) {
          const key = `${enemyTexture(enemy)}_${clip}`;
          if (!this.textures.exists(key)) this.load.spritesheet(key, `enemies/boss_racoon_${clip}.png`, { frameWidth: 60, frameHeight: 60 });
        }
        this.load.spritesheet(enemyTexture(enemy), 'enemies/boss_racoon_idle.png', { frameWidth: 60, frameHeight: 60 });
      } else this.load.spritesheet(enemyTexture(enemy), `enemies/${enemy}.png`, { frameWidth: 16, frameHeight: 16 });
    }
    if (!this.cache.audio.exists(musicKey(def.music))) this.load.audio(musicKey(def.music), `audio/music/${def.music}.ogg`);
    if (def.id === 'shrine') {
      if (!this.cache.audio.exists(musicKey('boss'))) this.load.audio(musicKey('boss'), 'audio/music/boss.ogg');
      if (!this.cache.audio.exists(musicKey('victory'))) this.load.audio(musicKey('victory'), 'audio/music/victory.ogg');
    }
  }

  create(): void {
    this.loaded = loadTiledMap(this, mapKey(this.mapDef.id), this.mapDef.tilesets);
    this.physics.world.setBounds(0, 0, this.loaded.widthPx, this.loaded.heightPx);
    this.cameras.main.setBounds(0, 0, this.loaded.widthPx, this.loaded.heightPx);
    Display.applyToCamera(this.cameras.main);
    this.displayUnsubscribe = Display.onChange(() => {
      Display.applyToCamera(this.cameras.main);
      this.cameraFollow?.snap();
    });

    this.inventory = new InventorySystem(this.session.save);
    this.quests = new QuestSystem(this.session.save);
    this.progression = new ProgressionSystem(this.session.save);
    this.audio = new AudioSystem(this, {
      masterVolume: 1,
      musicVolume: SettingsStore.get().musicVolume,
      sfxVolume: SettingsStore.get().sfxVolume,
      muted: false,
    });
    this.inputActions = new InputActions(this);

    const spawn = findSpawn(this.loaded, this.spawnId);
    const saved = this.session.save.player;
    const sx = this.resumePosition && saved.x !== undefined ? saved.x : spawn ? Math.round(spawn.x) : this.loaded.widthPx / 2;
    const sy = this.resumePosition && saved.y !== undefined ? saved.y : spawn ? Math.round(spawn.y) - 12 : this.loaded.heightPx / 2;
    const facing = this.resumePosition ? saved.facing : (spawn ? propStr(spawn, 'facing', 'down') : 'down') as Facing;
    this.player = new Player(this, sx, sy, {
      facing,
      hp: saved.hp,
      maxHp: saved.maxHp,
      weaponId: this.session.save.equipment.weapon,
      accessoryId: this.session.save.equipment.accessory,
    });
    this.player.input = this.inputActions;
    this.player.combat.setAttackBonus(attackBonusForLevel(saved.level));
    if (this.loaded.collision) this.physics.add.collider(this.player.sprite, this.loaded.collision);

    this.npcs.length = 0;
    for (const object of findObjects(this.loaded, 'NPCs', 'NPC')) {
      const npc = new Npc(this, {
        npcId: propStr(object, 'npcId'),
        facing: propStr(object, 'facing', 'down') as Facing,
        x: Math.round(object.x),
        y: Math.round(object.y) - 8,
      });
      this.npcs.push(npc);
      this.physics.add.collider(this.player.sprite, npc.sprite);
    }

    this.combat = new CombatSystem(this, this.player);
    this.registerBossAnimations();
    this.combat.setBossWorld({
      spawnHitbox: (config) => {
        this.combat.spawnHitbox(config);
      },
      spawnProjectile: (x, y, vx, vy, damage) => this.spawnBossProjectile(x, y, vx, vy, damage),
      telegraph: (x, y, kind) => this.combat.effectsLayer.telegraph(x, y, kind),
      onPhaseChange: (phase) => {
        if (phase === 2) this.ui?.showToast('The Mask Keeper sheds its calm.');
      },
      shake: (heavy) => this.combat.effectsLayer.shake(heavy),
      sfx: (id, volume, detune) => this.combat.effectsLayer.sfx(id, volume ?? 1, detune ?? 0),
    });
    this.combat.setWorldCollision(this.loaded.collision);
    const enemyObjects = findObjects(this.loaded, 'Enemies').filter((object) => {
      const enemyId = propStr(object, 'enemyId');
      return !getEnemy(enemyId).boss || !this.session.save.defeatedBosses.includes(enemyId);
    });
    this.combat.spawnEnemies(enemyObjects);

    const callbacks = {
      onNpc: (id: string) => this.talkToNpc(id),
      onObject: (id: string, kind: InteractableKind) => this.interactWithObject(id, kind),
      onChest: (id: string, lootTable: string) => this.openChest(id, lootTable),
    };
    const targets: Interactable[] = createMapInteractables(this, this.loaded, this.session.save.openedChests, callbacks);
    targets.push(...this.npcs.map((npc) => createNpcInteractable(npc, callbacks)));
    this.interactions = new InteractionSystem(this, this.player, this.inputActions, {
      session: this.session,
      targets,
      onInteract: (target) => {
        this.applyQuestUpdates(this.quests.recordObjectInteracted(target.id));
        if (target.id === 'shrine_ember' && this.session.save.flags['ending.relit_shrine']) this.finishGame();
      },
    });
    this.transitions = new MapTransitionSystem(this);

    for (const object of this.loaded.objects.Interactables ?? []) {
      if (object.type === 'Seal' && this.session.save.flags[propStr(object, 'openFlag', 'seal_open')]) this.openSealTiles(object);
      if (object.type === 'Brazier' && this.session.save.flags[`brazier.${propStr(object, 'interactionId', object.name)}`]) {
        this.showBrazierFlame(object.x, object.y);
      }
    }

    this.shrineLit = false;
    if (this.session.save.flags['ending.relit_shrine']) this.lightVillageShrine(false);

    this.cameraZones.length = 0;
    for (const object of findObjects(this.loaded, 'Camera', 'CameraBounds')) {
      this.cameraZones.push(new Phaser.Geom.Rectangle(object.x, object.y, object.width, object.height));
    }
    this.cameraZoneActive = false;

    this.cameraFollow = new CameraFollow(this.cameras.main, this.player.sprite);
    this.cameraFollow.setLookAheadDistance(Feel.cameraLookAhead);
    this.cameraFollow.snap();
    this.cameraFollow.update(0);
    this.cameras.main.fadeIn(260, 0, 0, 0);
    this.bindEvents();
    this.audio.playMusic(this.mapDef.music);

    if (!this.scene.isActive('UIScene')) this.scene.launch('UIScene');
    this.scene.bringToTop('UIScene');
    this.ui?.hideTransition();
    this.ui?.showMapName(this.mapDef.displayName);
    this.ui?.refreshAll();
    gameEvents.emit('areaEntered', { mapId: this.mapDef.id });
    this.applyQuestUpdates(this.quests.recordAreaEntered(this.mapDef.id));
    void this.autosave();

    // Once this map is running, quietly pull in whatever the doors lead to so the next transition is instant.
    this.time.delayedCall(500, () => this.prefetchNeighbours());

    if (import.meta.env.DEV && new URLSearchParams(location.search).has('debug')) this.debug = new DebugOverlay(this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.shutdownSystems());
  }

  get ui(): UIScene | null {
    const scene = this.scene.get('UIScene') as UIScene | null;
    return scene && this.scene.isActive('UIScene') ? scene : null;
  }

  hasItem(itemId: string): boolean {
    return this.inventory.has(itemId);
  }

  showHint(text: string): void {
    if (SettingsStore.get().showHints) this.ui?.showToast(text);
  }

  async autosave(): Promise<boolean> {
    this.syncSaveFromPlayer();
    this.session.accumulatePlaytime();
    return this.queueSave('autosave');
  }

  async saveForTransition(mapId: string, spawnId: string): Promise<boolean> {
    this.session.accumulatePlaytime();
    this.session.save.player.mapId = mapId;
    this.session.save.player.spawnId = spawnId;
    this.session.save.player.facing = this.player.facing;
    this.session.save.player.hp = this.player.health.current;
    delete this.session.save.player.x;
    delete this.session.save.player.y;
    return this.queueSave('transition');
  }

  async saveCurrent(): Promise<boolean> {
    this.syncSaveFromPlayer();
    this.session.accumulatePlaytime();
    return this.queueSave('manual');
  }

  endSession(): void {
    endSession();
  }

  override update(time: number, delta: number): void {
    this.inputActions.update(time);
    if (!this.player.controlLocked && !this.player.health.isDead && this.inputActions.pressed('throw')) this.throwShuriken();
    this.player.update(delta);
    this.combat.update(delta);
    if (!this.player.controlLocked && !this.player.health.isDead) this.interactions.update();
    else this.interactions.hidePrompt();
    this.player.postUpdate();
    for (const npc of this.npcs) npc.syncDepth();
    // Lead the camera in the direction of travel so the player sees more of where they are going.
    const move = this.player.body.velocity;
    const speed = Math.hypot(move.x, move.y);
    if (speed > 12) this.cameraFollow.setLookAheadDirection(move.x / speed, move.y / speed);
    else this.cameraFollow.setLookAheadDirection(0, 0);
    this.cameraFollow.update(delta);
    this.updateBossHud();
    this.debug?.update();
  }

  private bindEvents(): void {
    this.unsubscribers.push(
      gameEvents.on('playerHealthChanged', ({ hp }) => {
        this.session.save.player.hp = hp;
      }),
      gameEvents.on('playerDied', () => this.onPlayerDied()),
      gameEvents.on('enemyDefeated', (event) => this.onEnemyDefeated(event.enemyId, event.spawnId)),
    );
  }

  private talkToNpc(npcId: string): void {
    this.applyQuestUpdates(this.quests.recordNpcSpoken(npcId));
    gameEvents.emit('npcSpoken', { npcId });
    const node = this.dialogueForNpc(npcId);
    this.ui?.showDialogue(node, {
      onOption: (option) => this.chooseDialogueOption(option),
      onClose: () => {
        void this.autosave();
        if (npcId === 'merchant_botan') this.ui?.showShop();
      },
    });
  }

  private chooseDialogueOption(option: DialogueOption): void {
    if (!option.startsQuestId) return;
    const update = this.quests.start(option.startsQuestId);
    this.applyQuestUpdates([update]);
    this.ui?.showToast(`Quest started: ${getQuest(option.startsQuestId).title}`);
  }

  private dialogueForNpc(npcId: string): DialogueNode {
    // Everyone has something else to say once the Ember is burning again.
    if (this.session.save.flags['ending.relit_shrine'] && hasDialogue(`${npcId}_after`)) return getDialogue(`${npcId}_after`);
    const idByNpc: Record<string, string> = {
      elder_hana: this.quests.getProgress('quest_sleeping_guardian').status === 'active' ? 'elder_hana_guardian' : 'elder_hana_start',
      master_ryo: 'master_ryo_hint',
      child_mimi: this.quests.getProgress('quest_lost_charm').status === 'rewarded' ? 'child_mimi_rewarded' : 'child_mimi_start',
      merchant_botan: 'merchant_botan_shop',
      guard_goro: 'guard_goro_gate',
      hermit_sen: 'hermit_sen_hint',
    };
    const id = idByNpc[npcId];
    if (id) return getDialogue(id);
    return {
      id: dialogueId(`villager_${npcId}`),
      speakerId: npcId,
      portrait: `${npcId}_face`,
      lines: this.session.save.flags['ending.relit_shrine']
        ? ['The shrine is lit. I had forgotten what this square looks like in the warm.']
        : ['The old shrine road feels different tonight. Keep your blade close.'],
    };
  }

  private interactWithObject(id: string, kind: InteractableKind): void {
    const object = (this.loaded.objects.Interactables ?? []).find((entry) => propStr(entry, 'interactionId', entry.name) === id);
    const text = propStr(object, 'text', 'Nothing stirs.');
    if (kind === 'seal') {
      this.useSeal(object);
      return;
    }
    if (kind === 'brazier') {
      this.lightBrazier(id, object);
      return;
    }
    if (id === 'ember_pedestal') {
      if (!this.session.save.defeatedBosses.includes('boss_racoon')) {
        this.ui?.showToast('The Mask Keeper still watches the Ember.');
        return;
      }
      if (!this.inventory.has('ember')) {
        this.addLoot([{ itemId: 'ember', quantity: 1 }]);
        this.audio.playSfx('magic');
        this.ui?.showToast('You carry the Ember. Return to Elder Hana.');
        void this.autosave();
      } else this.ui?.showToast('The pedestal is empty. The Ember is safe with you.');
      return;
    }
    if (id === 'shrine_ember') {
      if (!this.inventory.has('ember')) {
        this.ui?.showToast(text);
        return;
      }
      const guardian = this.quests.getProgress('quest_sleeping_guardian');
      const returned = guardian.objectives['return_hana'] ?? 0;
      if (!returned) {
        this.ui?.showToast('Elder Hana should see the Ember before it is restored.');
        return;
      }
      this.audio.playSfx('fire_light');
      this.lightVillageShrine(true);
      return;
    }
    if (kind === 'savepoint') {
      this.player.health.heal(this.player.health.max);
      this.session.save.player.hp = this.player.health.current;
      void this.autosave().then(ok => this.ui?.showToast(ok ? 'Rested and saved.' : 'Rested. Save failed; try again.'));
      return;
    }
    if (kind === 'dummy') this.ui?.showToast(`${SettingsStore.keyLabel('attack')} attacks. Chain three cuts; ${SettingsStore.keyLabel('roll')} rolls through danger.`);
    else this.showObjectDialogue(kind === 'sign' ? 'Sign' : 'Old Shrine', text);
  }

  private showObjectDialogue(speaker: string, text: string): void {
    this.ui?.showDialogue({ id: dialogueId(`object_${speaker.toLowerCase().replace(/\s+/g, '_')}`), speakerId: speaker, lines: text.split('\n') });
  }

  private openChest(_id: string, lootTable: string): void {
    const drops = rollLoot(lootTable);
    this.addLoot(drops);
    const summary = drops.map((drop) => `${getItem(drop.itemId).name} x${drop.quantity}`).join(', ');
    this.ui?.showToast(`Found ${summary}`);
    void this.autosave();
  }

  private addLoot(entries: readonly InventoryEntry[]): void {
    for (const entry of entries) {
      const change = this.inventory.add(entry.itemId, entry.quantity);
      if (entry.itemId === 'coin') gameEvents.emit('coinsChanged', { coins: this.session.save.player.coins, delta: entry.quantity });
      else {
        gameEvents.emit('itemAcquired', { itemId: entry.itemId, quantity: change.newQuantity - change.previousQuantity });
        this.applyQuestUpdates(this.quests.recordItemAcquired(entry.itemId));
      }
    }
    this.audio.playSfx(entries.some((entry) => entry.itemId === 'coin') ? 'coin' : 'pickup');
    this.ui?.refreshAll();
  }

  private onEnemyDefeated(enemyId: string, spawnId: string): void {
    const definition = getEnemy(enemyId);
    const previousMaxHp = this.session.save.player.maxHp;
    const xp = this.progression.addXp(definition.xp);
    this.applyMaxHpIncrease(previousMaxHp);
    gameEvents.emit('xpChanged', { xp: xp.xp, level: xp.level });
    if (xp.levelsGained > 0) {
      this.player.combat.setAttackBonus(attackBonusForLevel(xp.level));
      gameEvents.emit('levelUp', { level: xp.level, maxHp: this.session.save.player.maxHp });
      this.ui?.showToast(`Level ${xp.level}! Your flame grows stronger.`);
      this.audio.playSfx('level_up');
    }
    this.applyQuestUpdates(this.quests.recordEnemyDefeated(enemyId));

    if (definition.boss) {
      if (!this.session.save.defeatedBosses.includes(enemyId)) this.session.save.defeatedBosses.push(enemyId);
      this.session.save.flags[`boss.${spawnId}.defeated`] = true;
      if (!this.inventory.has('broken_mask')) this.addLoot([{ itemId: 'broken_mask', quantity: 1 }]);
      // Death beat: freeze, cut the music, flash, then let the victory cue land in the silence.
      this.combat.hitStop.request(320);
      this.audio.stopMusic(220);
      this.combat.effectsLayer.shake(true);
      this.cameras.main.flash(360, 255, 214, 160);
      this.bossMusicActive = false;
      this.time.delayedCall(760, () => {
        this.audio.playMusic('victory', { fadeOutMs: 0, fadeInMs: 500 });
        this.releaseCameraZone();
        this.cameraFollow.snap();
      });
      this.ui?.showToast('The Mask Keeper falls. The Ember is within reach.');
    } else this.addLoot(rollLoot(`enemy_${enemyId}`));
    void this.autosave();
  }

  private applyQuestUpdates(updates: readonly QuestUpdate[]): void {
    const completed = new Set<string>();
    for (const update of updates) {
      gameEvents.emit('questUpdated', { questId: update.questId, status: update.status, objectiveId: update.objectiveId });
      if (update.completed && update.status === 'completed') completed.add(update.questId);
    }
    for (const questId of completed) {
      const beforeLevel = this.session.save.player.level;
      const beforeMaxHp = this.session.save.player.maxHp;
      const reward = this.quests.claimReward(questId);
      if (!reward) continue;
      this.applyMaxHpIncrease(beforeMaxHp);
      const quest = getQuest(questId);
      gameEvents.emit('questUpdated', { questId, status: 'rewarded' });
      gameEvents.emit('xpChanged', { xp: this.session.save.player.xp, level: this.session.save.player.level });
      gameEvents.emit('coinsChanged', { coins: this.session.save.player.coins, delta: reward.coins ?? 0 });
      for (const item of reward.items ?? []) gameEvents.emit('itemAcquired', { itemId: item.itemId, quantity: item.quantity });
      if (this.session.save.player.level > beforeLevel) gameEvents.emit('levelUp', { level: this.session.save.player.level, maxHp: this.session.save.player.maxHp });
      this.player.combat.setAttackBonus(attackBonusForLevel(this.session.save.player.level));
      this.audio?.playSfx('quest_complete');
      this.ui?.showToast(`Quest complete: ${quest.title}`);
      const guardian = this.quests.getProgress('quest_sleeping_guardian');
      if (guardian.status === 'active') gameEvents.emit('questUpdated', { questId: 'quest_sleeping_guardian', status: 'active' });
    }
    this.ui?.refreshAll();
  }

  private onPlayerDied(): void {
    if (this.gameOver) return;
    this.gameOver = true;
    this.session.save.player.hp = 0;
    this.audio.playSfx('game_over');
    this.ui?.showGameOver(() => this.retryFromCheckpoint());
  }

  private retryFromCheckpoint(): void {
    this.session.save.player.hp = this.session.save.player.maxHp;
    delete this.session.save.player.x;
    delete this.session.save.player.y;
    this.scene.restart({ mapId: this.mapDef.id, spawnId: this.spawnId });
  }

  private finishGame(): void {
    void this.autosave();
    this.audio.playMusic('victory');
    this.ui?.showEnding();
  }

  /**
   * Boss encounter framing. Entering the arena locks the camera to it, wakes the boss with its intro, and
   * swaps the music, so the fight starts as an event rather than as another chase down a corridor.
   */
  private updateBossHud(): void {
    const boss = this.combat.getLivingEnemies().find((enemy) => enemy.def.boss);
    if (!boss) {
      if (this.cameraZoneActive) this.releaseCameraZone();
      this.ui?.hideBoss();
      return;
    }
    const zone = this.cameraZones[0];
    const inArena = zone
      ? this.player.x >= zone.x && this.player.x <= zone.x + zone.width && this.player.y >= zone.y && this.player.y <= zone.y + zone.height
      : Phaser.Math.Distance.Between(this.player.x, this.player.y, boss.x, boss.y) <= boss.def.aggroRange + 28;

    if (!inArena) {
      // Leaving the arena (the east shortcut runs past it) has to give the camera back, or it stays clamped
      // to the arena rectangle while the player walks away.
      if (this.cameraZoneActive) this.releaseCameraZone();
      this.ui?.hideBoss();
      return;
    }
    if (!this.bossMusicActive) {
      this.bossMusicActive = true;
      this.audio.playMusic('boss', { fadeOutMs: 150, fadeInMs: 200 });
      if (boss instanceof BossEnemy) boss.wake();
      else this.audio.playSfx('boss_roar');
      this.cameras.main.flash(220, 40, 20, 30);
    }
    if (zone && !this.cameraZoneActive) this.applyCameraZone(zone);
    this.ui?.showBoss(boss.def.name, boss.health.current, boss.health.max);
  }

  /**
   * Frames a room. A zone smaller than the visible area would leave the camera showing the void outside the
   * map, so the zone is grown to at least the view size and then clamped inside the map.
   */
  private applyCameraZone(zone: Phaser.Geom.Rectangle): void {
    const camera = this.cameras.main;
    const viewWidth = camera.width / camera.zoomX;
    const viewHeight = camera.height / camera.zoomY;
    let width = Math.min(this.loaded.widthPx, Math.max(zone.width, Math.ceil(viewWidth)));
    let height = Math.min(this.loaded.heightPx, Math.max(zone.height, Math.ceil(viewHeight)));
    let x = Phaser.Math.Clamp(zone.centerX - width / 2, 0, Math.max(0, this.loaded.widthPx - width));
    let y = Phaser.Math.Clamp(zone.centerY - height / 2, 0, Math.max(0, this.loaded.heightPx - height));
    if (width >= this.loaded.widthPx) {
      width = this.loaded.widthPx;
      x = 0;
    }
    if (height >= this.loaded.heightPx) {
      height = this.loaded.heightPx;
      y = 0;
    }
    this.cameraZoneActive = true;
    camera.setBounds(Math.round(x), Math.round(y), Math.round(width), Math.round(height));
  }

  private releaseCameraZone(): void {
    if (!this.cameraZoneActive) return;
    this.cameraZoneActive = false;
    this.cameras.main.setBounds(0, 0, this.loaded.widthPx, this.loaded.heightPx);
  }

  private syncSaveFromPlayer(): void {
    const playerSave = this.session.save.player;
    playerSave.mapId = this.mapDef.id;
    playerSave.spawnId = this.spawnId;
    playerSave.x = Math.round(this.player.x);
    playerSave.y = Math.round(this.player.y);
    playerSave.facing = this.player.facing;
    playerSave.hp = this.player.health.current;
    playerSave.maxHp = this.player.health.max;
  }

  private applyMaxHpIncrease(previousMaxHp: number): void {
    const nextMaxHp = this.session.save.player.maxHp;
    if (nextMaxHp === previousMaxHp && this.player.health.max === nextMaxHp) return;
    const increase = Math.max(0, nextMaxHp - this.player.health.max);
    this.player.health.setMax(nextMaxHp);
    if (increase > 0) this.player.health.heal(increase);
    this.session.save.player.hp = this.player.health.current;
    gameEvents.emit('playerHealthChanged', { hp: this.player.health.current, maxHp: this.player.health.max });
  }

  private queueSave(reason: 'autosave' | 'transition' | 'manual'): Promise<boolean> {
    this.saveQueue = this.saveQueue.catch(() => false).then(async () => {
      try {
        const persisted = await this.saveSystem.save(this.session.save);
        this.session.save.savedAt = persisted.savedAt;
        return true;
      } catch (error) {
        console.error(`[SaveSystem] ${reason} save failed`, error);
        if (reason === 'autosave') this.ui?.showToast('Autosave unavailable in this browser.');
        return false;
      }
    });
    return this.saveQueue;
  }

  activateInventoryItem(itemId: string): void {
    const item = getItem(itemId);
    if (item.category === 'weapon' || item.category === 'accessory') {
      const slot = item.category === 'weapon' ? 'weapon' : 'accessory';
      const previousId = this.session.save.equipment[slot];
      if (slot === 'accessory' && previousId === itemId) {
        const bonus = item.accessory?.maxHpBonus ?? 0;
        this.inventory.unequip(slot);
        this.session.save.player.maxHp = Math.max(2, this.session.save.player.maxHp - bonus);
        this.player.health.setMax(this.session.save.player.maxHp);
        this.player.combat.setLoadout(this.session.save.equipment.weapon, null);
        this.ui?.showToast(`${item.name} unequipped.`);
      } else {
        const previousBonus = previousId ? getItem(previousId).accessory?.maxHpBonus ?? 0 : 0;
        const nextBonus = item.accessory?.maxHpBonus ?? 0;
        this.inventory.equip(itemId);
        this.session.save.player.maxHp += nextBonus - previousBonus;
        this.player.health.setMax(this.session.save.player.maxHp, nextBonus > previousBonus);
        this.session.save.player.hp = this.player.health.current;
        this.player.combat.setLoadout(this.session.save.equipment.weapon, this.session.save.equipment.accessory);
        this.ui?.showToast(`${item.name} equipped.`);
      }
      gameEvents.emit('playerHealthChanged', { hp: this.player.health.current, maxHp: this.player.health.max });
      this.ui?.refreshAll();
      void this.autosave();
      return;
    }
    const heal = item.consumable?.heal;
    if (!heal) {
      this.ui?.showToast(itemId === 'shuriken' ? 'Press L or C in the world to throw one.' : 'This item cannot be used here.');
      return;
    }
    const healed = this.player.health.heal(heal);
    if (!healed) {
      this.ui?.showToast('Your hearts are already full.');
      return;
    }
    this.inventory.remove(itemId, 1);
    this.session.save.player.hp = this.player.health.current;
    this.audio.playSfx('heal');
    this.ui?.showToast(`${item.name} restored ${healed} HP.`);
    this.ui?.refreshAll();
    void this.autosave();
  }

  buyItem(itemId: string, quantity: number, cost: number): void {
    if (this.session.save.player.coins < cost) {
      this.ui?.showToast('Not enough coins.');
      return;
    }
    const item = getItem(itemId);
    if (item.maxStack === 1 && this.inventory.has(itemId)) {
      this.ui?.showToast(`You already own ${item.name}.`);
      return;
    }
    this.inventory.remove('coin', cost);
    gameEvents.emit('coinsChanged', { coins: this.session.save.player.coins, delta: -cost });
    this.addLoot([{ itemId, quantity }]);
    this.ui?.showToast(`Bought ${item.name}${quantity > 1 ? ` x${quantity}` : ''}.`);
    void this.autosave();
  }

  /**
   * The ending has to exist in the world, not only in an overlay. Once the Ember is home the village shrine
   * burns: a pulsing warm glow, a small flame and drifting embers, restored on every later visit.
   */
  private lightVillageShrine(celebrate: boolean): void {
    if (this.shrineLit || this.mapDef.id !== 'village') return;
    const object = (this.loaded.objects.Interactables ?? []).find((entry) => propStr(entry, 'interactionId', entry.name) === 'shrine_ember');
    if (!object) return;
    this.shrineLit = true;
    const x = Math.round(object.x);
    const y = Math.round(object.y);
    const depth = Depth.ActorBase + y;

    const glow = this.add.ellipse(x, y - 4, 54, 34, 0xffb45c, 0.14).setBlendMode(Phaser.BlendModes.ADD).setDepth(depth - 3);
    this.tweens.add({ targets: glow, scaleX: 1.14, scaleY: 1.14, alpha: 0.26, duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    const flame = this.add.particles(x, y - 6, Tex.fxParticleFire, {
      frame: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
      speedY: { min: -26, max: -12 },
      speedX: { min: -5, max: 5 },
      lifespan: { min: 620, max: 1150 },
      frequency: 140,
      quantity: 1,
      scale: { start: 1, end: 0.35 },
      alpha: { start: 0.95, end: 0 },
    });
    flame.setDepth(depth + 1);

    // Embers drifting off the hill, so the change still reads from the square below.
    const motes = this.add.particles(0, 0, Tex.fxParticleFire, {
      frame: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
      speedY: { min: -16, max: -5 },
      speedX: { min: -9, max: 9 },
      lifespan: { min: 1600, max: 3000 },
      frequency: 520,
      quantity: 1,
      scale: { start: 0.85, end: 0.2 },
      alpha: { start: 0.65, end: 0 },
      emitZone: { type: 'random', source: new Phaser.Geom.Rectangle(x - 60, y - 24, 120, 90), quantity: 1 },
    });
    motes.setDepth(Depth.AbovePlayer - 1);

    if (celebrate) {
      this.combat.effectsLayer.bigSpark(x, y - 8);
      this.combat.effectsLayer.levelUp(x, y - 4);
      this.combat.effectsLayer.shake(true);
      this.cameras.main.flash(520, 255, 200, 130);
    }
  }

  /**
   * Braziers are the map's one environmental puzzle. Each is an ordinary prop that remembers a flag; lighting
   * every brazier of a puzzle sets the puzzle flag, which is what the vault seal asks for. No framework, just
   * flags and a flame.
   */
  private lightBrazier(id: string, object: TiledObject | undefined): void {
    if (!object) return;
    const flag = `brazier.${id}`;
    if (this.session.save.flags[flag]) return;
    this.session.save.flags[flag] = true;
    this.showBrazierFlame(object.x, object.y);
    this.audio.playSfx('fire_light');
    this.combat.effectsLayer.bigSpark(object.x, object.y - 10);

    const puzzleId = propStr(object, 'puzzleId');
    if (!puzzleId) return;
    const group = (this.loaded.objects.Interactables ?? []).filter((entry) => propStr(entry, 'puzzleId') === puzzleId);
    const lit = group.filter((entry) => this.session.save.flags[`brazier.${propStr(entry, 'interactionId', entry.name)}`]).length;
    if (lit < group.length) {
      this.ui?.showToast(`The brazier catches.  ${lit}/${group.length}`);
      return;
    }
    this.session.save.flags['shrine.braziers_lit'] = true;
    this.audio.playSfx('secret');
    this.combat.effectsLayer.shake(true);
    this.ui?.showToast('Four flames. Something heavy shifts in the west wall.');
    void this.autosave();
  }

  /** Small permanent flame on a lit brazier, drawn on interaction and again on every later map load. */
  private showBrazierFlame(x: number, y: number): void {
    const flame = this.add.particles(Math.round(x), Math.round(y) - 9, Tex.fxParticleFire, {
      frame: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
      speedY: { min: -22, max: -9 },
      speedX: { min: -4, max: 4 },
      lifespan: { min: 420, max: 800 },
      frequency: 170,
      quantity: 1,
      scale: { start: 0.9, end: 0.3 },
      alpha: { start: 0.95, end: 0 },
    });
    flame.setDepth(Depth.ActorBase + y);
  }

  /**
   * A key-gated barrier. Opening it removes the collision and the tiles for good, recorded on a world flag
   * so a reload keeps the way open.
   */
  private useSeal(object: TiledObject | undefined): void {
    if (!object) return;
    const flag = propStr(object, 'openFlag', 'seal_open');
    if (this.session.save.flags[flag]) return;
    const required = propStr(object, 'requiredItem');
    const requiredFlag = propStr(object, 'requiredFlag');
    if ((required && !this.inventory.has(required)) || (requiredFlag && !this.session.save.flags[requiredFlag])) {
      this.ui?.showToast(propStr(object, 'lockedMessage', 'It is sealed.'));
      this.audio.playSfx('menu_cancel');
      return;
    }
    this.session.save.flags[flag] = true;
    this.openSealTiles(object);
    this.audio.playSfx('door');
    this.combat.effectsLayer.shake(true);
    this.ui?.showToast(propStr(object, 'openMessage', 'The seal opens.'));
    void this.autosave();
  }

  /**
   * Clears the barrier tiles and their collision. Also runs on map load when the flag is already set.
   * Ground is left alone: the floor under a gate is already carved, and stripping it punched a black hole
   * in the corridor where the gate used to be.
   */
  private openSealTiles(object: TiledObject): void {
    const gx = propNum(object, 'gateX');
    const gy = propNum(object, 'gateY');
    const width = Math.max(1, propNum(object, 'gateWidth', 1));
    for (let x = gx; x < gx + width; x += 1) {
      this.loaded.collision?.removeTileAt(x, gy);
      for (const [name, layer] of Object.entries(this.loaded.layers)) {
        if (name === 'Ground') continue;
        layer.removeTileAt(x, gy);
      }
    }
  }

  /**
   * Warms the browser cache for every map reachable through a door on this one. Plain fetches, not the
   * Phaser loader: queuing into the scene loader raced with map transitions and re-registered texture keys
   * that were still in flight. Network time is the dominant cost of a cold map, so this recovers most of it
   * without touching the texture manager.
   */
  private prefetchNeighbours(): void {
    if (!this.scene.isActive()) return;
    const destinations = new Set<string>();
    for (const object of findObjects(this.loaded, 'Doors', 'Door')) {
      const destination = propStr(object, 'destinationMap');
      if (destination && destination !== this.mapDef.id) destinations.add(destination);
    }
    const paths: string[] = [];
    for (const id of destinations) {
      const def = MAPS[id];
      if (!def) continue;
      if (!this.cache.tilemap.exists(mapKey(def.id))) paths.push(`maps/${def.file}`);
      for (const tileset of def.tilesets) if (!this.textures.exists(tileset)) paths.push(`tiles/${tileset}.png`);
      for (const npc of def.npcs) {
        if (this.textures.exists(npcTexture(npc))) continue;
        paths.push(`characters/npcs/${npc}.png`, `characters/npcs/${npc}_face.png`);
      }
      for (const enemy of def.enemies) {
        if (this.textures.exists(enemyTexture(enemy))) continue;
        if (enemy === 'boss_racoon') paths.push('enemies/boss_racoon_idle.png');
        else paths.push(`enemies/${enemy}.png`);
      }
      if (!this.cache.audio.exists(musicKey(def.music))) paths.push(`audio/music/${def.music}.ogg`);
    }
    for (const path of paths) void fetch(`${ASSET_ROOT}${path}`, { cache: 'force-cache' }).catch(() => undefined);
  }

  /** Boss sheets are four separate strips, so the animations are built here once per map load. */
  private registerBossAnimations(): void {
    const base = enemyTexture('boss_racoon');
    const clips: Array<{ name: 'idle' | 'charge' | 'attack' | 'jump'; frames: number; rate: number; repeat: number }> = [
      { name: 'idle', frames: 6, rate: 7, repeat: -1 },
      { name: 'charge', frames: 2, rate: 6, repeat: -1 },
      { name: 'attack', frames: 4, rate: 12, repeat: 0 },
      { name: 'jump', frames: 5, rate: 12, repeat: -1 },
    ];
    for (const clip of clips) {
      const key = `boss_racoon_${clip.name}`;
      const texture = `${base}_${clip.name}`;
      if (this.anims.exists(key) || !this.textures.exists(texture)) continue;
      this.anims.create({
        key,
        frames: this.anims.generateFrameNumbers(texture, { start: 0, end: clip.frames - 1 }),
        frameRate: clip.rate,
        repeat: clip.repeat,
      });
    }
  }

  /** Spirit orb fired by the boss burst. Dies on walls and after a short life so the arena never fills up. */
  private spawnBossProjectile(x: number, y: number, vx: number, vy: number, damage: number): void {
    const orb = this.physics.add.sprite(x, y, Tex.fxProjEnergy, 0).setDepth(Depth.AbovePlayer);
    orb.play('proj_energy');
    orb.setTint(0xa9c8ff);
    orb.body?.setSize(9, 9);
    orb.setVelocity(vx, vy);
    const hitbox = this.combat.spawnHitbox({
      x,
      y,
      width: 11,
      height: 11,
      faction: 'enemy',
      damage,
      knockback: 120,
      hitstop: Feel.hitstopLight,
      duration: 2600,
      follow: { target: orb, offsetX: 0, offsetY: 0 },
      tags: ['boss', 'projectile'],
    });
    const kill = () => {
      if (!orb.active) return;
      hitbox.done = true;
      this.combat.effectsLayer.hitSpark(orb.x, orb.y);
      orb.destroy();
    };
    if (this.loaded.collision) this.physics.add.collider(orb, this.loaded.collision, kill);
    this.time.delayedCall(2500, kill);
  }

  private throwShuriken(): void {
    if (!this.player.fsm.is('idle') && !this.player.fsm.is('move')) return;
    if (!this.inventory.has('shuriken')) {
      this.ui?.showToast('No shuriken left.');
      return;
    }
    this.inventory.remove('shuriken', 1);
    const facing = this.player.facingVector;
    const projectile = this.physics.add.sprite(this.player.body.center.x + facing.x * 10, this.player.body.center.y + facing.y * 10, Tex.fxProjShuriken, 0);
    projectile.play('proj_shuriken').setDepth(Depth.AbovePlayer);
    projectile.body?.setSize(8, 8);
    projectile.setVelocity(facing.x * 190, facing.y * 190);
    const hitbox = this.combat.spawnHitbox({
      x: projectile.x,
      y: projectile.y,
      width: 12,
      height: 12,
      faction: 'player',
      damage: 3 + attackBonusForLevel(this.session.save.player.level),
      knockback: 90,
      hitstop: 45,
      duration: 720,
      follow: { target: projectile, offsetX: 0, offsetY: 0 },
      owner: this.player,
      tags: ['projectile', 'shuriken'],
    });
    if (this.loaded.collision) this.physics.add.collider(projectile, this.loaded.collision, () => {
      hitbox.done = true;
      projectile.destroy();
    });
    this.time.delayedCall(740, () => projectile.destroy());
    this.audio.playSfx('throw');
    this.ui?.refreshAll();
  }

  private shutdownSystems(): void {
    this.displayUnsubscribe?.();
    this.displayUnsubscribe = null;
    this.ui?.hideBoss();
    for (const unsubscribe of this.unsubscribers.splice(0)) unsubscribe();
    this.transitions.destroy();
    this.interactions.destroy();
    this.combat.destroy();
    this.audio.destroy();
    this.npcs.length = 0;
    this.inputActions.destroy();
    this.debug?.destroy();
    this.debug = null;
  }

  /** DEV bridge helper used by browser tests. */
  getEnemyBySpawnId(spawnId: string): BaseEnemy | undefined {
    return this.combat.enemies.find((enemy) => enemy.spawnId === spawnId);
  }
}
