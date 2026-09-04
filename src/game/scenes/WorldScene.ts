import Phaser from 'phaser';
import { CombatSystem } from '../combat/CombatSystem';
import { ASSET_ROOT, Tex, enemyTexture, mapKey, musicKey, npcTexture } from '../config/assets';
import { Depth } from '../config/constants';
import { CameraFollow } from '../core/CameraFollow';
import { gameEvents } from '../core/events';
import { getSession, type GameSession, type InventoryEntry } from '../core/session';
import { getDialogue, type DialogueNode, type DialogueOption } from '../data/dialogue';
import { getEnemy } from '../data/enemies';
import { getItem } from '../data/items';
import { rollLoot } from '../data/loot';
import { getMapDef, type MapDefinition } from '../data/maps';
import { getQuest } from '../data/quests';
import { DebugOverlay } from '../debug/DebugOverlay';
import type { BaseEnemy } from '../entities/enemies/BaseEnemy';
import { Npc } from '../entities/npcs/Npc';
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
import { findObjects, findSpawn, loadTiledMap, propStr, type LoadedMap } from '../world/MapLoader';
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
  private readonly saveSystem = new SaveSystem();
  private saveQueue: Promise<void> = Promise.resolve();
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
      if (enemy === 'boss_racoon') this.load.spritesheet(enemyTexture(enemy), 'enemies/boss_racoon_idle.png', { frameWidth: 60, frameHeight: 60 });
      else this.load.spritesheet(enemyTexture(enemy), `enemies/${enemy}.png`, { frameWidth: 16, frameHeight: 16 });
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
    this.cameras.main.setRoundPixels(true);

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

    this.cameraFollow = new CameraFollow(this.cameras.main, this.player.sprite);
    this.cameraFollow.snap();
    this.cameraFollow.update(0);
    this.cameras.main.fadeIn(350, 0, 0, 0);
    this.bindEvents();
    this.audio.playMusic(this.mapDef.music);

    if (!this.scene.isActive('UIScene')) this.scene.launch('UIScene');
    this.scene.bringToTop('UIScene');
    this.ui?.showMapName(this.mapDef.displayName);
    this.ui?.refreshAll();
    gameEvents.emit('areaEntered', { mapId: this.mapDef.id });
    this.applyQuestUpdates(this.quests.recordAreaEntered(this.mapDef.id));
    void this.autosave();

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

  async autosave(): Promise<void> {
    this.syncSaveFromPlayer();
    this.session.accumulatePlaytime();
    await this.queueSave('autosave');
  }

  async saveForTransition(mapId: string, spawnId: string): Promise<void> {
    this.session.accumulatePlaytime();
    this.session.save.player.mapId = mapId;
    this.session.save.player.spawnId = spawnId;
    this.session.save.player.facing = this.player.facing;
    this.session.save.player.hp = this.player.health.current;
    delete this.session.save.player.x;
    delete this.session.save.player.y;
    await this.queueSave('transition');
  }

  override update(time: number, delta: number): void {
    this.inputActions.update(time);
    if (!this.player.controlLocked && !this.player.health.isDead && this.inputActions.pressed('throw')) this.throwShuriken();
    this.player.update(delta);
    this.combat.update(delta);
    if (!this.player.controlLocked && !this.player.health.isDead) this.interactions.update();
    this.player.postUpdate();
    for (const npc of this.npcs) npc.syncDepth();
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
    const idByNpc: Record<string, string> = {
      elder_hana: this.quests.getProgress('quest_sleeping_guardian').status === 'active' ? 'elder_hana_guardian' : 'elder_hana_start',
      master_ryo: 'master_ryo_hint',
      child_mimi: 'child_mimi_start',
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
      lines: ['The old shrine road feels different tonight. Keep your blade close.'],
    };
  }

  private interactWithObject(id: string, kind: InteractableKind): void {
    const object = (this.loaded.objects.Interactables ?? []).find((entry) => propStr(entry, 'interactionId', entry.name) === id);
    const text = propStr(object, 'text', 'Nothing stirs.');
    if (id === 'ember_pedestal') {
      if (!this.session.save.defeatedBosses.includes('boss_racoon')) {
        this.ui?.showToast('The corrupted Guardian still watches the Ember.');
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
      return;
    }
    if (kind === 'savepoint') {
      this.player.health.heal(this.player.health.max);
      this.session.save.player.hp = this.player.health.current;
      void this.autosave();
      this.ui?.showToast('Rested and saved.');
      return;
    }
    if (kind === 'dummy') this.ui?.showToast('J attacks. Chain three cuts; K rolls through danger.');
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
      this.audio.playMusic('victory');
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

  private updateBossHud(): void {
    const boss = this.combat.getLivingEnemies().find((enemy) => enemy.def.boss);
    const closeEnough = boss && Phaser.Math.Distance.Between(this.player.x, this.player.y, boss.x, boss.y) <= boss.def.aggroRange + 28;
    if (boss && closeEnough) {
      if (!this.bossMusicActive) {
        this.bossMusicActive = true;
        this.audio.playMusic('boss');
        this.audio.playSfx('boss_roar');
      }
      this.ui?.showBoss(boss.def.name, boss.health.current, boss.health.max);
    } else this.ui?.hideBoss();
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

  private queueSave(reason: 'autosave' | 'transition'): Promise<void> {
    this.saveQueue = this.saveQueue.catch(() => undefined).then(async () => {
      try {
        const persisted = await this.saveSystem.save(this.session.save);
        this.session.save.savedAt = persisted.savedAt;
      } catch (error) {
        console.error(`[SaveSystem] ${reason} save failed`, error);
        if (reason === 'autosave') this.ui?.showToast('Autosave unavailable in this browser.');
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
    this.ui?.hideBoss();
    for (const unsubscribe of this.unsubscribers.splice(0)) unsubscribe();
    this.transitions.destroy();
    this.interactions.destroy();
    this.combat.destroy();
    this.audio.stopMusic();
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
