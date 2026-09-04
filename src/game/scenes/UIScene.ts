import Phaser from 'phaser';
import { Tex, sfxKey } from '../config/assets';
import { Depth, GAME_HEIGHT, GAME_WIDTH } from '../config/constants';
import { gameEvents } from '../core/events';
import { getSession, hasSession } from '../core/session';
import type { DialogueNode, DialogueOption } from '../data/dialogue';
import { getItem } from '../data/items';
import { QUESTS } from '../data/quests';
import { InputActions } from '../input/InputActions';
import { SettingsStore } from '../systems/SettingsStore';
import { NinePanel } from '../ui/widgets/NinePanel';
import type { WorldScene } from './WorldScene';

type PanelKind = 'inventory' | 'quests' | 'pause' | 'shop';

const SHOP_ITEMS = [
  { itemId: 'rice_ball', quantity: 1, cost: 10 },
  { itemId: 'shuriken', quantity: 5, cost: 15 },
  { itemId: 'life_potion', quantity: 1, cost: 40 },
  { itemId: 'heavy_blade', quantity: 1, cost: 120 },
] as const;

interface DialogueCallbacks {
  onOption?: (option: DialogueOption) => void;
  onClose?: () => void;
}

/** Persistent overlay scene: HUD plus every modal surface used by the vertical slice. */
export class UIScene extends Phaser.Scene {
  private hearts: Phaser.GameObjects.Image[] = [];
  private mapLabel!: Phaser.GameObjects.BitmapText;
  private statsLabel!: Phaser.GameObjects.BitmapText;
  private questLabel!: Phaser.GameObjects.BitmapText;
  private banner: Phaser.GameObjects.BitmapText | null = null;
  private toast: Phaser.GameObjects.Container | null = null;
  private inputActions!: InputActions;
  private panel: Phaser.GameObjects.Container | null = null;
  private panelKind: PanelKind | null = null;
  private settingIndex = 0;
  private listIndex = 0;
  private dialogue: Phaser.GameObjects.Container | null = null;
  private dialogueNode: DialogueNode | null = null;
  private dialogueLine = 0;
  private dialogueOption = 0;
  private dialogueCallbacks: DialogueCallbacks = {};
  private dialogueBody: Phaser.GameObjects.BitmapText | null = null;
  private dialogueChoices: Phaser.GameObjects.BitmapText | null = null;
  private special: Phaser.GameObjects.Container | null = null;
  private specialAction: (() => void) | null = null;
  private modalReadyAt = 0;
  private bossHud: Phaser.GameObjects.Container | null = null;
  private bossName: Phaser.GameObjects.BitmapText | null = null;
  private bossFill: Phaser.GameObjects.Rectangle | null = null;
  private readonly unsubscribers: Array<() => void> = [];

  constructor() {
    super('UIScene');
  }

  create(): void {
    this.cameras.main.setRoundPixels(true);
    this.inputActions = new InputActions(this);
    this.mapLabel = this.add.bitmapText(8, 20, Tex.font, '', 8).setTint(0xd9d2c5).setDepth(Depth.UI).setAlpha(0.85);
    this.statsLabel = this.add.bitmapText(8, 31, Tex.font, '', 8).setTint(0xf0b45a).setDepth(Depth.UI).setAlpha(0.9);
    this.questLabel = this.add.bitmapText(GAME_WIDTH - 8, 8, Tex.font, '', 8).setOrigin(1, 0).setTint(0xf2ead8).setDepth(Depth.UI).setMaxWidth(214);
    this.refreshAll();

    this.unsubscribers.push(
      gameEvents.on('playerHealthChanged', () => this.refreshAll()),
      gameEvents.on('coinsChanged', () => this.refreshAll()),
      gameEvents.on('xpChanged', () => this.refreshAll()),
      gameEvents.on('questUpdated', () => this.refreshAll()),
      gameEvents.on('toast', ({ text }) => this.showToast(text)),
    );
    this.events.on(Phaser.Scenes.Events.WAKE, this.refreshAll, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.inputActions.destroy();
      for (const unsubscribe of this.unsubscribers.splice(0)) unsubscribe();
      this.events.off(Phaser.Scenes.Events.WAKE, this.refreshAll, this);
    });
  }

  refreshAll(): void {
    if (!hasSession()) return;
    this.refreshHearts();
    const save = getSession().save;
    this.statsLabel?.setText(`LV ${save.player.level}   XP ${save.player.xp}   COIN ${save.player.coins}`);
    const active = Object.values(QUESTS).find((quest) => save.quests[quest.id]?.status === 'active');
    if (!active) {
      this.questLabel?.setText(save.flags['ending.relit_shrine'] ? 'EMBER RESTORED' : 'Q  QUESTS');
      return;
    }
    const progress = save.quests[active.id];
    const objective = active.objectives.find((entry) => (progress?.objectives[entry.id] ?? 0) < entry.count);
    const amount = objective ? progress?.objectives[objective.id] ?? 0 : 0;
    this.questLabel?.setText(objective ? `${active.title.toUpperCase()}\n${objective.label}  ${amount}/${objective.count}` : `${active.title.toUpperCase()}\nReturn for your reward`);
  }

  refreshHearts(): void {
    for (const heart of this.hearts) heart.destroy();
    this.hearts = [];
    if (!hasSession()) return;
    const save = getSession().save;
    const total = Math.ceil(save.player.maxHp / 2);
    for (let i = 0; i < total; i += 1) {
      const hpForHeart = save.player.hp - i * 2;
      const frame = hpForHeart >= 2 ? 4 : hpForHeart === 1 ? 2 : 0;
      this.hearts.push(this.add.image(8 + i * 14, 8, Tex.hearts, frame).setOrigin(0, 0).setDepth(Depth.UI));
    }
  }

  setMapLabel(text: string): void {
    this.mapLabel.setText(text);
  }

  showMapName(name: string): void {
    this.banner?.destroy();
    const text = this.add.bitmapText(GAME_WIDTH / 2, 30, Tex.font, name.toUpperCase(), 8).setOrigin(0.5).setTint(0xf0b45a).setDepth(Depth.UI).setAlpha(0);
    text.setLetterSpacing(2);
    this.banner = text;
    this.tweens.add({ targets: text, alpha: 1, duration: 400, delay: 300, yoyo: true, hold: 1600, onComplete: () => text.destroy() });
  }

  showToast(text: string): void {
    this.toast?.destroy();
    const width = Math.min(430, Math.max(84, text.length * 8 + 18));
    const panel = new NinePanel(this, 0, 0, width, 22, Tex.panelDark);
    const label = this.add.bitmapText(width / 2, 7, Tex.font, text, 8).setOrigin(0.5, 0).setTint(0xf2ead8).setMaxWidth(width - 12);
    const container = this.add.container(Math.round(GAME_WIDTH / 2 - width / 2), GAME_HEIGHT - 42, [panel, label]).setDepth(Depth.UI).setAlpha(0);
    this.toast = container;
    this.tweens.add({ targets: container, alpha: 1, duration: 150, yoyo: true, hold: 1500, onComplete: () => { container.destroy(); if (this.toast === container) this.toast = null; } });
  }

  showDialogue(node: DialogueNode, callbacks: DialogueCallbacks = {}): void {
    this.closePanel(false);
    this.closeDialogue(false);
    this.setWorldLocked(true);
    this.dialogueNode = node;
    this.dialogueCallbacks = callbacks;
    this.dialogueLine = 0;
    this.dialogueOption = 0;
    this.modalReadyAt = this.time.now + 180;

    const panel = new NinePanel(this, 0, 0, 448, 72, Tex.panelWood);
    const items: Phaser.GameObjects.GameObject[] = [panel];
    let textX = 14;
    if (node.portrait && this.textures.exists(node.portrait)) {
      items.push(this.add.image(28, 36, node.portrait).setDisplaySize(38, 38));
      textX = 55;
    }
    const speaker = this.add.bitmapText(textX, 8, Tex.font, this.displayName(node.speakerId), 8).setTint(0xf0b45a);
    this.dialogueBody = this.add.bitmapText(textX, 22, Tex.font, '', 8).setTint(0xf2ead8).setMaxWidth(448 - textX - 12);
    this.dialogueChoices = this.add.bitmapText(textX, 42, Tex.font, '', 8).setTint(0xcfe7ad).setMaxWidth(448 - textX - 12);
    const hint = this.add.bitmapText(434, 59, Tex.font, 'E', 8).setOrigin(1, 0).setTint(0x9a8f80);
    items.push(speaker, this.dialogueBody, this.dialogueChoices, hint);
    this.dialogue = this.add.container(16, 188, items).setDepth(Depth.UI + 10);
    this.renderDialogue();
    this.sound.play(sfxKey('dialogue_blip'), { volume: 0.25 });
  }

  showBoss(name: string, hp: number, maxHp: number): void {
    if (!this.bossHud) {
      const panel = new NinePanel(this, 0, 0, 210, 24, Tex.panelDark);
      this.bossName = this.add.bitmapText(105, 4, Tex.font, '', 8).setOrigin(0.5, 0).setTint(0xffd29a);
      const under = this.add.rectangle(12, 16, 186, 4, 0x24191c).setOrigin(0, 0.5);
      this.bossFill = this.add.rectangle(12, 16, 186, 4, 0xc9504d).setOrigin(0, 0.5);
      this.bossHud = this.add.container(135, 8, [panel, this.bossName, under, this.bossFill]).setDepth(Depth.UI + 2);
    }
    this.bossName?.setText(name.toUpperCase());
    if (this.bossFill) this.bossFill.width = Math.max(0, Math.round(186 * hp / Math.max(1, maxHp)));
    this.bossHud.setVisible(true);
  }

  hideBoss(): void {
    this.bossHud?.setVisible(false);
  }

  showGameOver(onRetry: () => void): void {
    this.showSpecial('THE EMBER FADES', 'Press E or Enter to rise at the last checkpoint.', () => {
      this.closeSpecial(false);
      onRetry();
    }, 0xb84545);
  }

  showEnding(): void {
    this.showSpecial('EMBER RESTORED', 'Warm light returns to Kagehara.\n\nThank you for playing Emberfall.', () => this.closeSpecial(), 0xf0b45a);
  }

  showShop(): void {
    this.openPanel('shop');
  }

  override update(time: number): void {
    this.inputActions.update(time);
    if (time < this.modalReadyAt) return;
    if (this.special) {
      if (this.inputActions.pressed('confirm') || this.inputActions.pressed('cancel')) this.specialAction?.();
      return;
    }
    if (this.dialogue) {
      if (this.dialogueNode?.options?.length) {
        if (this.inputActions.pressed('menuDown')) this.moveDialogueOption(1);
        if (this.inputActions.pressed('menuUp')) this.moveDialogueOption(-1);
      }
      if (this.inputActions.pressed('confirm')) this.advanceDialogue();
      if (this.inputActions.pressed('cancel')) this.closeDialogue();
      return;
    }
    if (this.panel) {
      if (this.panelKind === 'pause') {
        if (this.inputActions.pressed('menuDown')) this.moveSetting(1);
        if (this.inputActions.pressed('menuUp')) this.moveSetting(-1);
        if (this.inputActions.pressed('menuLeft')) this.adjustSetting(-1);
        if (this.inputActions.pressed('menuRight') || this.inputActions.pressed('confirm')) this.adjustSetting(1);
      } else if (this.panelKind === 'inventory' || this.panelKind === 'shop') {
        if (this.inputActions.pressed('menuDown')) this.moveList(1);
        if (this.inputActions.pressed('menuUp')) this.moveList(-1);
        if (this.inputActions.pressed('confirm')) this.activateListItem();
      }
      if (this.inputActions.pressed('cancel') || this.inputActions.pressed('pause') || (this.panelKind === 'inventory' && this.inputActions.pressed('inventory')) || (this.panelKind === 'quests' && this.inputActions.pressed('quests'))) this.closePanel();
      return;
    }
    if (this.inputActions.pressed('inventory')) this.openPanel('inventory');
    else if (this.inputActions.pressed('quests')) this.openPanel('quests');
    else if (this.inputActions.pressed('pause')) this.openPanel('pause');
  }

  private renderDialogue(): void {
    const node = this.dialogueNode;
    if (!node || !this.dialogueBody || !this.dialogueChoices) return;
    this.dialogueBody.setText(node.lines[this.dialogueLine] ?? '');
    const onLastLine = this.dialogueLine >= node.lines.length - 1;
    this.dialogueChoices.setText(onLastLine && node.options?.length ? node.options.map((option, index) => `${index === this.dialogueOption ? '>' : ' '} ${option.label}`).join('\n') : '');
  }

  private advanceDialogue(): void {
    const node = this.dialogueNode;
    if (!node) return;
    if (this.dialogueLine < node.lines.length - 1) {
      this.dialogueLine += 1;
      this.renderDialogue();
      this.sound.play(sfxKey('dialogue_blip'), { volume: 0.2 });
      return;
    }
    const option = node.options?.[this.dialogueOption];
    if (option) this.dialogueCallbacks.onOption?.(option);
    this.closeDialogue();
  }

  private moveDialogueOption(direction: number): void {
    const count = this.dialogueNode?.options?.length ?? 0;
    if (!count) return;
    this.dialogueOption = (this.dialogueOption + direction + count) % count;
    this.renderDialogue();
    this.sound.play(sfxKey('menu_move'), { volume: 0.25 });
  }

  private closeDialogue(unlock = true): void {
    if (!this.dialogue) return;
    this.dialogue.destroy(true);
    this.dialogue = null;
    this.dialogueNode = null;
    this.dialogueBody = null;
    this.dialogueChoices = null;
    const callback = this.dialogueCallbacks.onClose;
    this.dialogueCallbacks = {};
    if (unlock) {
      this.setWorldLocked(false);
      callback?.();
    }
  }

  private openPanel(kind: PanelKind): void {
    if (!hasSession()) return;
    this.closePanel(false);
    this.panelKind = kind;
    this.settingIndex = 0;
    this.listIndex = 0;
    this.setWorldLocked(true);
    this.modalReadyAt = this.time.now + 160;
    this.renderPanel();
  }

  private renderPanel(): void {
    this.panel?.destroy(true);
    const kind = this.panelKind;
    if (!kind || !hasSession()) return;
    const panel = new NinePanel(this, 0, 0, 400, 206, Tex.panelWood);
    const title = this.add.bitmapText(16, 12, Tex.font, kind.toUpperCase(), 16).setTint(0xf0b45a);
    const body = this.add.bitmapText(18, 39, Tex.font, this.panelText(kind), 8).setTint(0xf2ead8).setMaxWidth(364);
    const interactive = kind === 'inventory' || kind === 'shop' || kind === 'pause';
    const hint = this.add.bitmapText(382, 188, Tex.font, interactive ? 'ARROWS / E / ESC' : 'ESC TO CLOSE', 8).setOrigin(1, 0).setTint(0x9a8f80);
    this.panel = this.add.container(40, 32, [panel, title, body, hint]).setDepth(Depth.UI + 8);
  }

  private panelText(kind: PanelKind): string {
    const save = getSession().save;
    if (kind === 'inventory') {
      const lines = save.inventory.map((entry, index) => {
        const item = getItem(entry.itemId);
        const equipped = save.equipment.weapon === entry.itemId || save.equipment.accessory === entry.itemId ? ' [EQUIPPED]' : '';
        return `${index === this.listIndex ? '>' : ' '} ${item.name} x${entry.quantity}${equipped}`;
      });
      const selected = save.inventory[this.listIndex];
      const description = selected ? getItem(selected.itemId).description : 'Your pack is empty.';
      return `Coins: ${save.player.coins}\n\n${lines.join('\n')}\n\n${description}`;
    }
    if (kind === 'quests') {
      const lines = Object.values(QUESTS).map((quest) => {
        const progress = save.quests[quest.id];
        if (!progress || progress.status === 'locked') return '';
        const objectives = quest.objectives.map((entry) => `  ${(progress.objectives[entry.id] ?? 0) >= entry.count ? '[x]' : '[ ]'} ${entry.label}`).join('\n');
        return `${quest.title} - ${progress.status.toUpperCase()}\n${objectives}`;
      }).filter(Boolean);
      return lines.length ? lines.join('\n\n') : 'No quests yet. Speak with the villagers.';
    }
    if (kind === 'shop') {
      const rows = SHOP_ITEMS.map((offer, index) => {
        const item = getItem(offer.itemId);
        const quantity = offer.quantity > 1 ? ` x${offer.quantity}` : '';
        return `${index === this.listIndex ? '>' : ' '} ${item.name}${quantity}  ${offer.cost}c`;
      });
      const selected = SHOP_ITEMS[this.listIndex] ?? SHOP_ITEMS[0];
      return `Coins: ${save.player.coins}\n\n${rows.join('\n\n')}\n\n${selected ? getItem(selected.itemId).description : ''}`;
    }
    const settings = SettingsStore.get();
    const rows = ['Resume', `Master Volume  ${Math.round(settings.masterVolume * 100)}%`, `Screen Shake   ${settings.screenShake ? 'ON' : 'OFF'}`, `Hints          ${settings.showHints ? 'ON' : 'OFF'}`];
    return rows.map((row, index) => `${index === this.settingIndex ? '>' : ' '} ${row}`).join('\n\n');
  }

  private moveSetting(direction: number): void {
    this.settingIndex = (this.settingIndex + direction + 4) % 4;
    this.sound.play(sfxKey('menu_move'), { volume: 0.25 });
    this.renderPanel();
  }

  private moveList(direction: number): void {
    const count = this.panelKind === 'shop' ? SHOP_ITEMS.length : getSession().save.inventory.length;
    if (!count) return;
    this.listIndex = (this.listIndex + direction + count) % count;
    this.sound.play(sfxKey('menu_move'), { volume: 0.25 });
    this.renderPanel();
  }

  private activateListItem(): void {
    const world = this.scene.get('WorldScene') as WorldScene | null;
    if (!world || !this.scene.isActive('WorldScene')) return;
    if (this.panelKind === 'shop') {
      const offer = SHOP_ITEMS[this.listIndex];
      if (offer) world.buyItem(offer.itemId, offer.quantity, offer.cost);
    } else if (this.panelKind === 'inventory') {
      const entry = getSession().save.inventory[this.listIndex];
      if (entry) world.activateInventoryItem(entry.itemId);
      this.listIndex = Math.min(this.listIndex, Math.max(0, getSession().save.inventory.length - 1));
    }
    this.renderPanel();
  }

  private adjustSetting(direction: number): void {
    if (this.settingIndex === 0) {
      this.closePanel();
      return;
    }
    const current = SettingsStore.get();
    if (this.settingIndex === 1) {
      const volume = Phaser.Math.Clamp(Math.round((current.masterVolume + direction * 0.1) * 10) / 10, 0, 1);
      SettingsStore.set({ masterVolume: volume });
      this.sound.volume = volume;
    } else if (this.settingIndex === 2) SettingsStore.set({ screenShake: !current.screenShake });
    else SettingsStore.set({ showHints: !current.showHints });
    this.sound.play(sfxKey('menu_accept'), { volume: 0.25 });
    this.renderPanel();
  }

  private closePanel(unlock = true): void {
    this.panel?.destroy(true);
    this.panel = null;
    this.panelKind = null;
    if (unlock) this.setWorldLocked(false);
  }

  private showSpecial(title: string, body: string, action: () => void, tint: number): void {
    this.closeDialogue(false);
    this.closePanel(false);
    this.closeSpecial(false);
    this.setWorldLocked(true);
    this.modalReadyAt = this.time.now + 400;
    const shade = this.add.rectangle(-70, -72, GAME_WIDTH, GAME_HEIGHT, 0x09070c, 0.88).setOrigin(0, 0);
    const panel = new NinePanel(this, 0, 0, 340, 126, Tex.panelWood);
    const heading = this.add.bitmapText(170, 22, Tex.font, title, 16).setOrigin(0.5, 0).setTint(tint);
    const copy = this.add.bitmapText(170, 54, Tex.font, body, 8).setOrigin(0.5, 0).setTint(0xf2ead8).setCenterAlign().setMaxWidth(306);
    const hint = this.add.bitmapText(170, 105, Tex.font, 'E / ENTER', 8).setOrigin(0.5, 0).setTint(0x9a8f80);
    this.special = this.add.container(70, 72, [shade, panel, heading, copy, hint]).setDepth(Depth.UI + 20);
    this.specialAction = action;
  }

  private closeSpecial(unlock = true): void {
    this.special?.destroy(true);
    this.special = null;
    this.specialAction = null;
    if (unlock) this.setWorldLocked(false);
  }

  private setWorldLocked(locked: boolean): void {
    const world = this.scene.get('WorldScene') as WorldScene | null;
    if (!world || !this.scene.isActive('WorldScene') || !world.player || !world.inputActions) return;
    world.player.controlLocked = locked;
    world.player.body.velocity.set(0, 0);
    world.inputActions.setEnabled(false);
    if (!world.player.health.isDead) world.player.fsm.set(locked ? 'interact' : 'idle');
    if (!locked) {
      // Confirm and interact share keys. Let the closing key fully release before world input resumes,
      // otherwise one press can close and immediately reopen the same dialogue on the next frame.
      this.time.delayedCall(140, () => {
        if (!this.dialogue && !this.panel && !this.special && this.scene.isActive('WorldScene')) world.inputActions.setEnabled(true);
      });
    }
  }

  private displayName(id: string): string {
    return id.split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
  }
}
