import Phaser from 'phaser';
import { Tex, itemTexture, sfxKey } from '../config/assets';
import { Depth } from '../config/constants';
import { gameEvents } from '../core/events';
import { getSession, hasSession } from '../core/session';
import type { DialogueNode, DialogueOption } from '../data/dialogue';
import { getItem } from '../data/items';
import { QUESTS } from '../data/quests';
import { InputActions } from '../input/InputActions';
import { SettingsStore } from '../systems/SettingsStore';
import { Display } from '../systems/DisplaySystem';
import { ReleaseMenu } from '../ui/ReleaseMenu';
import { NinePanel, UiColor } from '../ui/widgets/NinePanel';
import { Plate } from '../ui/widgets/Plate';
import type { WorldScene } from './WorldScene';

type PanelKind = 'inventory' | 'quests' | 'shop';

/** Top of the boss health bar. Clears the heart plate (ends at y 39) on the narrowest supported view. */
const BOSS_HUD_Y = 44;

const SHOP_ITEMS = [
  { itemId: 'rice_ball', quantity: 1, cost: 10 },
  { itemId: 'shuriken', quantity: 5, cost: 15 },
  { itemId: 'life_potion', quantity: 1, cost: 40 },
  // Priced so a thorough player can afford it before the shrine as an alternative to two potions; the vault
  // still hands one out for free to anyone who solves the braziers.
  { itemId: 'heavy_blade', quantity: 1, cost: 80 },
] as const;

interface DialogueCallbacks {
  onOption?: (option: DialogueOption) => void;
  onClose?: () => void;
}

/**
 * Persistent overlay scene: HUD plus every modal surface.
 *
 * Everything is laid out from `Display.width/height` rather than fixed constants, because the canvas now
 * fills the browser window and the logical size changes with it. `layout()` re-runs whenever the display
 * changes, so the HUD stays anchored to the real corners at any window size.
 */
export class UIScene extends Phaser.Scene {
  private hud!: Phaser.GameObjects.Container;
  private hearts: Phaser.GameObjects.Image[] = [];
  private heartPlate!: Plate;
  private statPlate!: Plate;
  private statsLabel!: Phaser.GameObjects.BitmapText;
  private coinIcon!: Phaser.GameObjects.Image;
  private questPlate!: Plate;
  private questTitle!: Phaser.GameObjects.BitmapText;
  private questLabel!: Phaser.GameObjects.BitmapText;
  private banner: Phaser.GameObjects.Container | null = null;
  private toast: Phaser.GameObjects.Container | null = null;
  private inputActions!: InputActions;

  private panel: Phaser.GameObjects.Container | null = null;
  private panelKind: PanelKind | null = null;
  private listIndex = 0;
  private releaseMenu: ReleaseMenu | null = null;

  private dialogue: Phaser.GameObjects.Container | null = null;
  private dialogueNode: DialogueNode | null = null;
  private dialogueLine = 0;
  private dialogueOption = 0;
  private dialogueCallbacks: DialogueCallbacks = {};
  private dialogueBody: Phaser.GameObjects.BitmapText | null = null;
  private dialogueChoices: Phaser.GameObjects.BitmapText | null = null;
  private dialogueReveal = 0;
  private dialogueFullText = '';
  private dialogueBodyTop = 28;

  private transition: Phaser.GameObjects.Container | null = null;
  private transitionTimer: Phaser.Time.TimerEvent | null = null;
  private special: Phaser.GameObjects.Container | null = null;
  private specialAction: (() => void) | null = null;
  private specialChoices: Array<{ label: string; action: () => void }> = [];
  private specialIndex = 0;
  private modalReadyAt = 0;

  private bossHud: Phaser.GameObjects.Container | null = null;
  private bossName: Phaser.GameObjects.BitmapText | null = null;
  private bossFill: Phaser.GameObjects.Rectangle | null = null;
  private bossTrail: Phaser.GameObjects.Rectangle | null = null;
  private bossRatio = 1;

  private readonly unsubscribers: Array<() => void> = [];

  constructor() {
    super('UIScene');
  }

  private get w(): number {
    return Display.width;
  }

  private get h(): number {
    return Display.height;
  }

  create(): void {
    // Phaser reuses scene instances after returning to the title. Display objects do not survive shutdown.
    this.hearts = [];
    this.banner = this.toast = this.panel = this.dialogue = this.transition = this.special = this.bossHud = null;
    this.panelKind = null;
    this.dialogueNode = null;
    this.dialogueBody = this.dialogueChoices = this.bossName = null;
    this.bossFill = this.bossTrail = null;
    this.transitionTimer = null;
    this.specialAction = null;
    this.specialChoices = [];
    this.dialogueCallbacks = {};
    this.modalReadyAt = 0;
    Display.applyToCamera(this.cameras.main);
    this.inputActions = new InputActions(this);
    this.releaseMenu = new ReleaseMenu(this, this.inputActions, {
      onResume: () => this.setWorldLocked(false),
      onClose: () => this.setWorldLocked(false),
      onSaveAndQuit: () => this.saveAndQuitToTitle(),
    });
    this.buildHud();
    this.layout();
    this.refreshAll();

    this.unsubscribers.push(
      gameEvents.on('playerHealthChanged', () => this.refreshAll()),
      gameEvents.on('coinsChanged', () => this.refreshAll()),
      gameEvents.on('xpChanged', () => this.refreshAll()),
      gameEvents.on('questUpdated', () => this.refreshAll()),
      gameEvents.on('toast', ({ text }) => this.showToast(text)),
      Display.onChange(() => {
        Display.applyToCamera(this.cameras.main);
        this.layout();
        this.rebuildOpenSurfaces();
        this.releaseMenu?.resize();
      }),
    );
    this.events.on(Phaser.Scenes.Events.WAKE, this.refreshAll, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.inputActions.destroy();
      this.releaseMenu?.destroy();
      this.releaseMenu = null;
      for (const unsubscribe of this.unsubscribers.splice(0)) unsubscribe();
      this.events.off(Phaser.Scenes.Events.WAKE, this.refreshAll, this);
    });
  }

  // ---------------------------------------------------------------- HUD

  private buildHud(): void {
    this.heartPlate = new Plate(this, 76, 20, { radius: 4, alpha: 0.55 });
    this.statPlate = new Plate(this, 84, 15, { radius: 4, alpha: 0.55 });
    this.statsLabel = this.add.bitmapText(0, 0, Tex.font, '', 8).setTint(UiColor.text);
    this.coinIcon = this.add.image(0, 0, itemTexture('coin')).setOrigin(0, 0.5);
    this.questPlate = new Plate(this, 130, 34, { radius: 4, alpha: 0.55 });
    this.questTitle = this.add.bitmapText(0, 0, Tex.font, '', 8).setOrigin(1, 0).setTint(UiColor.ember);
    this.questLabel = this.add.bitmapText(0, 0, Tex.font, '', 8).setOrigin(1, 0).setTint(UiColor.text);
    this.hud = this.add
      .container(0, 0, [this.heartPlate, this.statPlate, this.statsLabel, this.coinIcon, this.questPlate, this.questTitle, this.questLabel])
      .setDepth(Depth.UI);
  }

  /** Anchor every persistent element to the current logical viewport. */
  private layout(): void {
    const pad = 7;
    this.heartPlate.setPosition(pad - 3, pad - 3);
    this.statPlate.setPosition(pad - 3, pad + 17);
    this.statsLabel.setPosition(pad + 13, pad + 21);
    this.coinIcon.setPosition(pad + 2, pad + 25);
    // The plate has rounded corners, so the text needs more inset on the right than the flat left edge.
    this.questTitle.setPosition(this.w - pad - 3, pad);
    this.questLabel.setPosition(this.w - pad - 3, pad + 11).setMaxWidth(150);
    this.positionHearts();
    this.refreshQuestPlate();
    if (this.bossHud) this.bossHud.setPosition(Math.round(this.w / 2 - 108), BOSS_HUD_Y);
  }

  private rebuildOpenSurfaces(): void {
    if (this.panelKind) this.renderPanel();
    if (this.dialogueNode) {
      const node = this.dialogueNode;
      const callbacks = this.dialogueCallbacks;
      const line = this.dialogueLine;
      const option = this.dialogueOption;
      this.closeDialogue(false);
      this.showDialogue(node, callbacks);
      this.dialogueLine = line;
      this.dialogueOption = option;
      this.renderDialogue();
    }
  }

  refreshAll(): void {
    if (!hasSession()) return;
    this.refreshHearts();
    const save = getSession().save;
    this.statsLabel.setText(`LV ${save.player.level}    ${save.player.coins}`);
    this.statPlate.resize(Math.max(62, this.statsLabel.width + 22), 15);

    const active = Object.values(QUESTS).find((quest) => save.quests[quest.id]?.status === 'active');
    if (!active) {
      const done = Boolean(save.flags['ending.relit_shrine']);
      this.questTitle.setText(done ? 'EMBER RESTORED' : 'QUESTS');
      this.questLabel.setText(done || !SettingsStore.get().showHints ? '' : `${SettingsStore.keyLabel('quests')} to open`);
    } else {
      const progress = save.quests[active.id];
      const objective = active.objectives.find((entry) => (progress?.objectives[entry.id] ?? 0) < entry.count);
      const amount = objective ? (progress?.objectives[objective.id] ?? 0) : 0;
      this.questTitle.setText(active.title.toUpperCase());
      this.questLabel.setText(objective ? `${objective.label}  ${amount}/${objective.count}` : 'Return for your reward');
    }
    this.refreshQuestPlate();
  }

  private refreshQuestPlate(): void {
    const width = Math.max(this.questTitle.width, this.questLabel.width) + 16;
    // Objective lines wrap, so the plate is sized from what the labels actually measure.
    const height = Math.ceil(this.questTitle.height + (this.questLabel.text ? this.questLabel.height + 3 : 0)) + 11;
    this.questPlate.resize(width, height).setPosition(this.w - width - 4, 4);
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
      const heart = this.add.image(0, 0, Tex.hearts, frame).setOrigin(0, 0);
      this.hearts.push(heart);
      this.hud.add(heart);
    }
    this.positionHearts();
  }

  private positionHearts(): void {
    const pad = 7;
    this.hearts.forEach((heart, index) => heart.setPosition(pad + index * 13, pad - 1));
    this.heartPlate.resize(Math.max(28, this.hearts.length * 13 + 6), 18);
  }

  setMapLabel(_text: string): void {
    // The persistent map label was replaced by the animated area card in showMapName.
  }

  /** Area name card that fades in at the top centre when a map loads. */
  showMapName(name: string): void {
    this.banner?.destroy(true);
    const label = this.add.bitmapText(0, 5, Tex.font, name.toUpperCase(), 8).setOrigin(0.5, 0).setTint(UiColor.emberBright);
    label.setLetterSpacing(2);
    const width = label.width + 34;
    const plate = new Plate(this, width, 19, { radius: 4, alpha: 0.66, stroke: UiColor.ember, strokeAlpha: 0.35 });
    plate.setPosition(-width / 2, 0);
    const container = this.add.container(Math.round(this.w / 2), 56, [plate, label]).setDepth(Depth.UI + 1).setAlpha(0);
    this.banner = container;
    this.tweens.add({
      targets: container,
      alpha: 1,
      y: 50,
      duration: 420,
      delay: 220,
      ease: 'Cubic.easeOut',
      yoyo: true,
      hold: 1500,
      onComplete: () => {
        container.destroy(true);
        if (this.banner === container) this.banner = null;
      },
    });
  }

  showToast(text: string): void {
    this.toast?.destroy(true);
    const maxWidth = Math.min(this.w - 48, 216);
    const label = this.add.bitmapText(0, 6, Tex.font, text, 8).setOrigin(0.5, 0).setTint(UiColor.text).setMaxWidth(maxWidth).setCenterAlign();
    const width = Math.min(this.w - 24, Math.max(90, label.width + 26));
    const height = label.height + 13;
    const plate = new Plate(this, width, height, { radius: 4, alpha: 0.82, stroke: UiColor.textFaint, strokeAlpha: 0.4 });
    plate.setPosition(-width / 2, 0);
    const container = this.add
      .container(Math.round(this.w / 2), this.h - height - 14, [plate, label])
      .setDepth(Depth.UI + 3)
      .setAlpha(0);
    this.toast = container;
    this.tweens.add({
      targets: container,
      alpha: 1,
      y: this.h - height - 20,
      duration: 170,
      yoyo: true,
      hold: 1500,
      onComplete: () => {
        container.destroy(true);
        if (this.toast === container) this.toast = null;
      },
    });
  }

  // ---------------------------------------------------------------- dialogue

  showDialogue(node: DialogueNode, callbacks: DialogueCallbacks = {}): void {
    this.closePanel(false);
    this.closeDialogue(false);
    this.setWorldLocked(true);
    this.dialogueNode = node;
    this.dialogueCallbacks = callbacks;
    this.dialogueLine = 0;
    this.dialogueOption = 0;
    this.modalReadyAt = this.time.now + 180;

    const width = Math.min(this.w - 28, 380);
    const hasPortrait = Boolean(node.portrait && this.textures.exists(node.portrait));
    const textX = hasPortrait && node.portrait ? 60 : 14;
    const textWidth = width - textX - 14;

    // The box is sized to its longest line plus the choices, so a wrapped line can never land on top of them.
    this.dialogueBodyTop = 28;
    const bodyHeight = Math.max(...node.lines.map((line) => this.measureWrapped(line, textWidth)), 10);
    const choiceText = node.options?.length ? node.options.map((option) => `> ${option.label}`).join('\n') : '';
    const choicesHeight = choiceText ? this.measureWrapped(choiceText, textWidth) + 6 : 0;
    const height = Math.max(78, this.dialogueBodyTop + bodyHeight + choicesHeight + 16);

    const frame = new NinePanel(this, 0, 0, width, height, Tex.panelWood);
    const inner = new Plate(this, width - 14, height - 14, { radius: 2, fill: 0x1a1720, alpha: 0.93 });
    inner.setPosition(7, 7);
    const items: Phaser.GameObjects.GameObject[] = [frame, inner];

    if (hasPortrait && node.portrait) {
      const portraitFrame = new Plate(this, 42, 42, { radius: 2, fill: 0x0d0b12, alpha: 0.95, stroke: UiColor.ember, strokeAlpha: 0.55 });
      portraitFrame.setPosition(12, 22);
      items.push(portraitFrame, this.add.image(33, 43, node.portrait).setDisplaySize(38, 38));
    }
    const speaker = this.add.bitmapText(textX, 14, Tex.font, this.displayName(node.speakerId), 8).setTint(UiColor.emberBright);
    this.dialogueBody = this.add.bitmapText(textX, this.dialogueBodyTop, Tex.font, '', 8).setTint(UiColor.text).setMaxWidth(textWidth);
    this.dialogueChoices = this.add.bitmapText(textX, this.dialogueBodyTop + bodyHeight + 6, Tex.font, '', 8).setTint(UiColor.good).setMaxWidth(textWidth);
    const hint = this.add.bitmapText(width - 12, height - 17, Tex.font, SettingsStore.keyLabel('interact'), 8).setOrigin(1, 0).setTint(UiColor.textFaint);
    items.push(speaker, this.dialogueBody, this.dialogueChoices, hint);

    this.dialogue = this.add
      .container(Math.round((this.w - width) / 2), this.h - height - 12, items)
      .setDepth(Depth.UI + 10);
    this.renderDialogue();
    this.sound.play(sfxKey('dialogue_blip'), { volume: 0.25 });
  }

  /** Height a wrapped bitmap line will occupy, measured once so layout can reserve room for it. */
  private measureWrapped(text: string, maxWidth: number): number {
    const probe = this.add.bitmapText(0, 0, Tex.font, text, 8).setMaxWidth(maxWidth);
    const height = probe.height;
    probe.destroy();
    return Math.ceil(height);
  }

  private renderDialogue(): void {
    const node = this.dialogueNode;
    if (!node || !this.dialogueBody || !this.dialogueChoices) return;
    this.dialogueFullText = node.lines[this.dialogueLine] ?? '';
    this.dialogueReveal = 0;
    this.dialogueBody.setText('');
    const onLastLine = this.dialogueLine >= node.lines.length - 1;
    this.dialogueChoices.setText(
      onLastLine && node.options?.length
        ? node.options.map((option, index) => `${index === this.dialogueOption ? '>' : ' '} ${option.label}`).join('\n')
        : '',
    );
    this.dialogueChoices.setVisible(false);
  }

  /** Typewriter reveal: fast enough not to slow reading, slow enough to feel spoken. */
  private updateDialogueReveal(delta: number): void {
    if (!this.dialogueBody) return;
    if (this.dialogueReveal >= this.dialogueFullText.length) {
      if (this.dialogueChoices && !this.dialogueChoices.visible) this.dialogueChoices.setVisible(true);
      return;
    }
    this.dialogueReveal = Math.min(this.dialogueFullText.length, this.dialogueReveal + delta * 0.06);
    this.dialogueBody.setText(this.dialogueFullText.slice(0, Math.floor(this.dialogueReveal)));
  }

  private advanceDialogue(): void {
    const node = this.dialogueNode;
    if (!node) return;
    if (this.dialogueReveal < this.dialogueFullText.length) {
      this.dialogueReveal = this.dialogueFullText.length;
      this.dialogueBody?.setText(this.dialogueFullText);
      this.dialogueChoices?.setVisible(true);
      return;
    }
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
    const node = this.dialogueNode;
    const count = node?.options?.length ?? 0;
    if (!count || !node?.options) return;
    this.dialogueOption = (this.dialogueOption + direction + count) % count;
    this.dialogueChoices?.setText(node.options.map((option, index) => `${index === this.dialogueOption ? '>' : ' '} ${option.label}`).join('\n'));
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

  /**
   * Shown while a map loads behind the fade. It only appears if the load actually takes a moment, so short
   * cached transitions stay clean; a first visit no longer looks like the game froze.
   */
  showTransition(): void {
    this.transitionTimer?.remove(false);
    this.transitionTimer = this.time.delayedCall(320, () => {
      if (this.transition) return;
      const label = this.add.bitmapText(0, 0, Tex.font, 'ENTERING', 8).setOrigin(0.5, 0.5).setTint(UiColor.textDim);
      const ember = this.add.image(0, -18, itemTexture('ember')).setOrigin(0.5);
      this.tweens.add({ targets: ember, scale: { from: 0.85, to: 1.15 }, alpha: { from: 0.65, to: 1 }, duration: 620, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.transition = this.add
        .container(Math.round(this.w / 2), Math.round(this.h / 2), [ember, label])
        .setDepth(Depth.UI + 30)
        .setAlpha(0);
      this.tweens.add({ targets: this.transition, alpha: 1, duration: 200 });
    });
  }

  hideTransition(): void {
    this.transitionTimer?.remove(false);
    this.transitionTimer = null;
    this.transition?.destroy(true);
    this.transition = null;
  }

  // ---------------------------------------------------------------- boss

  showBoss(name: string, hp: number, maxHp: number): void {
    const width = 216;
    if (!this.bossHud) {
      const frame = new NinePanel(this, 0, 0, width, 28, Tex.panelWood);
      const inner = new Plate(this, width - 14, 14, { radius: 2, fill: 0x140f14, alpha: 0.95 });
      inner.setPosition(7, 12);
      this.bossName = this.add.bitmapText(width / 2, 4, Tex.font, '', 8).setOrigin(0.5, 0).setTint(UiColor.emberBright);
      this.bossTrail = this.add.rectangle(9, 19, width - 18, 10, 0xffd9a8).setOrigin(0, 0.5);
      this.bossFill = this.add.rectangle(9, 19, width - 18, 10, 0xc0433f).setOrigin(0, 0.5);
      // Sits below the heart and stat plates: at 320 logical pixels a top-aligned bar overlapped them.
      this.bossHud = this.add
        .container(Math.round(this.w / 2 - width / 2), BOSS_HUD_Y, [frame, inner, this.bossName, this.bossTrail, this.bossFill])
        .setDepth(Depth.UI + 2)
        .setAlpha(0);
      this.bossRatio = 1;
      this.tweens.add({ targets: this.bossHud, alpha: 1, duration: 400 });
    }
    this.bossName?.setText(name.toUpperCase());
    const ratio = Phaser.Math.Clamp(hp / Math.max(1, maxHp), 0, 1);
    const full = width - 18;
    if (this.bossFill) this.bossFill.width = Math.max(0, Math.round(full * ratio));
    // The pale bar trails the red one, so each hit reads as a visible chunk taken off.
    if (this.bossTrail && ratio < this.bossRatio) {
      this.tweens.killTweensOf(this.bossTrail);
      this.tweens.add({ targets: this.bossTrail, width: Math.max(0, Math.round(full * ratio)), duration: 430, delay: 130, ease: 'Cubic.easeOut' });
    } else if (this.bossTrail) {
      this.bossTrail.width = Math.max(0, Math.round(full * ratio));
    }
    this.bossRatio = ratio;
    this.bossHud.setVisible(true);
    this.bossHud.setPosition(Math.round(this.w / 2 - width / 2), BOSS_HUD_Y);
    this.setQuestTrackerVisible(false);
  }

  hideBoss(): void {
    this.setQuestTrackerVisible(true);
    if (!this.bossHud || !this.bossHud.visible) return;
    const hud = this.bossHud;
    this.tweens.add({ targets: hud, alpha: 0, duration: 500, onComplete: () => hud.setVisible(false) });
  }

  /** The boss bar and the quest tracker both want the top-right; only one is shown at a time. */
  private setQuestTrackerVisible(visible: boolean): void {
    this.questPlate.setVisible(visible);
    this.questTitle.setVisible(visible);
    this.questLabel.setVisible(visible);
  }

  // ---------------------------------------------------------------- modals

  showGameOver(onRetry: () => void): void {
    this.showSpecial('THE EMBER FADES', `Press ${SettingsStore.keyLabel('interact')} to rise at the last checkpoint.`, () => {
      this.closeSpecial(false);
      onRetry();
    }, UiColor.danger);
  }

  showEnding(): void {
    const save = hasSession() ? getSession().save : null;
    const minutes = save ? Math.max(1, Math.round(save.playtimeMs / 60000)) : 0;
    const body = save
      ? `Warm light returns to Kagehara.\nLV ${save.player.level}   ${save.player.coins} coins   ${minutes} min`
      : 'Warm light returns to Kagehara.';
    this.showSpecial(
      'EMBER RESTORED',
      body,
      () => this.closeSpecial(),
      UiColor.ember,
      [
        { label: 'Continue Exploring', action: () => this.closeSpecial() },
        { label: 'Return to Title', action: () => void this.saveAndQuitToTitle() },
      ],
    );
  }

  showShop(): void {
    this.openPanel('shop');
  }

  override update(time: number, delta: number): void {
    this.inputActions.update(time);
    if (this.dialogue) this.updateDialogueReveal(delta);
    if (time < this.modalReadyAt) return;

    if (this.releaseMenu?.active) {
      this.releaseMenu.update(time);
      return;
    }
    if (this.special) {
      if (this.specialChoices.length) {
        if (this.inputActions.pressed('menuDown')) this.moveSpecialChoice(1);
        if (this.inputActions.pressed('menuUp')) this.moveSpecialChoice(-1);
        if (this.inputActions.pressed('confirm')) this.specialChoices[this.specialIndex]?.action();
        if (this.inputActions.pressed('cancel')) this.specialChoices[0]?.action();
      } else if (this.inputActions.pressed('confirm') || this.inputActions.pressed('cancel')) this.specialAction?.();
      return;
    }
    if (this.dialogue) {
      if (this.dialogueNode?.options?.length && this.dialogueReveal >= this.dialogueFullText.length) {
        if (this.inputActions.pressed('menuDown')) this.moveDialogueOption(1);
        if (this.inputActions.pressed('menuUp')) this.moveDialogueOption(-1);
      }
      if (this.inputActions.pressed('confirm')) this.advanceDialogue();
      else if (this.inputActions.pressed('cancel')) this.closeDialogue();
      return;
    }
    if (this.panel) {
      if (this.panelKind === 'inventory' || this.panelKind === 'shop') {
        if (this.inputActions.pressed('menuDown')) this.moveList(this.panelKind === 'inventory' ? 5 : 1);
        if (this.inputActions.pressed('menuUp')) this.moveList(this.panelKind === 'inventory' ? -5 : -1);
        if (this.inputActions.pressed('menuRight')) this.moveList(1);
        if (this.inputActions.pressed('menuLeft')) this.moveList(-1);
        if (this.inputActions.pressed('confirm')) this.activateListItem();
      }
      if (
        this.inputActions.pressed('cancel') ||
        this.inputActions.pressed('pause') ||
        (this.panelKind === 'inventory' && this.inputActions.pressed('inventory')) ||
        (this.panelKind === 'quests' && this.inputActions.pressed('quests'))
      ) {
        this.closePanel();
      }
      return;
    }
    if (this.inputActions.pressed('inventory')) this.openPanel('inventory');
    else if (this.inputActions.pressed('quests')) this.openPanel('quests');
    else if (this.inputActions.pressed('pause')) this.openPause();
  }

  private openPanel(kind: PanelKind): void {
    if (!hasSession()) return;
    this.closePanel(false);
    this.panelKind = kind;
    this.listIndex = 0;
    this.setWorldLocked(true);
    this.modalReadyAt = this.time.now + 160;
    this.renderPanel();
    this.sound.play(sfxKey('menu_accept'), { volume: 0.3 });
  }

  /** Shared modal chrome: dim the world, wood frame, dark inset, title, footer hint. */
  private beginModal(
    title: string,
    width: number,
    height: number,
    hint: string,
  ): { container: Phaser.GameObjects.Container; items: Phaser.GameObjects.GameObject[]; x: number; y: number; contentTop: number } {
    const shade = this.add.rectangle(0, 0, this.w, this.h, 0x07060b, 0.62).setOrigin(0, 0);
    const x = Math.round((this.w - width) / 2);
    const y = Math.round((this.h - height) / 2);
    const frame = new NinePanel(this, x, y, width, height, Tex.panelWood);
    const inner = new Plate(this, width - 14, height - 30, { radius: 2, fill: 0x191621, alpha: 0.95 });
    inner.setPosition(x + 7, y + 23);
    const heading = this.add.bitmapText(x + 12, y + 8, Tex.font, title, 8).setTint(UiColor.emberBright);
    heading.setLetterSpacing(2);
    const hintLabel = this.add.bitmapText(x + width - 12, y + 8, Tex.font, hint, 8).setOrigin(1, 0).setTint(UiColor.textFaint);
    const items: Phaser.GameObjects.GameObject[] = [shade, frame, inner, heading, hintLabel];
    const container = this.add.container(0, 0, [...items]).setDepth(Depth.UI + 8);
    return { container, items: [], x, y, contentTop: y + 30 };
  }

  private renderPanel(): void {
    this.panel?.destroy(true);
    this.panel = null;
    const kind = this.panelKind;
    if (!kind || !hasSession()) return;
    if (kind === 'inventory') this.renderInventory();
    else if (kind === 'shop') this.renderShop();
    else if (kind === 'quests') this.renderQuests();
  }

  private renderInventory(): void {
    const save = getSession().save;
    const width = Math.min(this.w - 32, 326);
    const height = Math.min(this.h - 28, 172);
    const { container, items, x, contentTop } = this.beginModal('INVENTORY', width, height, this.modalHint(['up', 'down', 'interact', 'pause']));

    const cols = 5;
    const cell = 23;
    const gridX = x + 14;
    const entries = save.inventory;
    const slots = Math.max(entries.length, cols * 3);
    for (let i = 0; i < slots; i += 1) {
      const row = Math.floor(i / cols);
      if (row > 2) break;
      const cx = gridX + (i % cols) * cell;
      const cy = contentTop + row * cell;
      items.push(this.add.image(cx, cy, Tex.inventoryCell).setOrigin(0, 0).setDisplaySize(20, 20).setAlpha(entries[i] ? 1 : 0.35));
      const entry = entries[i];
      if (!entry) continue;
      const item = getItem(entry.itemId);
      items.push(this.add.image(cx + 10, cy + 10, itemTexture(item.id)).setOrigin(0.5));
      if (entry.quantity > 1) {
        items.push(this.add.bitmapText(cx + 19, cy + 11, Tex.font, String(entry.quantity), 8).setOrigin(1, 0).setTint(UiColor.text));
      }
      if (save.equipment.weapon === entry.itemId || save.equipment.accessory === entry.itemId) {
        items.push(this.add.rectangle(cx + 1, cy + 1, 18, 2, 0xf0b45a).setOrigin(0, 0));
      }
      if (i === this.listIndex) items.push(this.add.rectangle(cx - 1, cy - 1, 22, 22).setOrigin(0, 0).setStrokeStyle(1, 0xffd08a));
    }

    const detailX = gridX + cols * cell + 8;
    const detailWidth = x + width - 14 - detailX;
    const selected = entries[this.listIndex];
    items.push(
      this.add.bitmapText(detailX, contentTop, Tex.font, selected ? getItem(selected.itemId).name : 'Empty', 8).setTint(UiColor.emberBright).setMaxWidth(detailWidth),
    );
    items.push(
      this.add
        .bitmapText(detailX, contentTop + 14, Tex.font, selected ? getItem(selected.itemId).description : 'Your pack is empty.', 8)
        .setTint(UiColor.textDim)
        .setMaxWidth(detailWidth),
    );
    if (selected) {
      const item = getItem(selected.itemId);
      const verb = item.category === 'weapon' || item.category === 'accessory' ? `${SettingsStore.keyLabel('interact')}   EQUIP` : item.consumable ? `${SettingsStore.keyLabel('interact')}   USE` : '';
      if (verb) items.push(this.add.bitmapText(detailX, contentTop + 50, Tex.font, verb, 8).setTint(UiColor.good));
    }
    const coinY = contentTop + 3 * cell + 8;
    items.push(this.add.image(gridX + 1, coinY, itemTexture('coin')).setOrigin(0, 0.5));
    items.push(this.add.bitmapText(gridX + 13, coinY - 4, Tex.font, `${save.player.coins}`, 8).setTint(UiColor.coin));
    container.add(items);
    this.panel = container;
  }

  private renderShop(): void {
    const save = getSession().save;
    const width = Math.min(this.w - 32, 304);
    const height = Math.min(this.h - 28, 178);
    const { container, items, x, contentTop } = this.beginModal('BOTAN STALL', width, height, this.modalHint(['up', 'down', 'interact', 'pause']));
    SHOP_ITEMS.forEach((offer, index) => {
      const item = getItem(offer.itemId);
      const rowY = contentTop + index * 25;
      const selected = index === this.listIndex;
      if (selected) items.push(this.add.rectangle(x + 11, rowY - 3, width - 22, 23, 0x2f2a3a).setOrigin(0, 0));
      items.push(this.add.image(x + 24, rowY + 8, Tex.inventoryCell).setOrigin(0.5).setDisplaySize(18, 18).setAlpha(0.85));
      items.push(this.add.image(x + 24, rowY + 8, itemTexture(item.id)).setOrigin(0.5));
      const label = `${item.name}${offer.quantity > 1 ? ` x${offer.quantity}` : ''}`;
      items.push(this.add.bitmapText(x + 38, rowY, Tex.font, label, 8).setTint(selected ? UiColor.emberBright : UiColor.text));
      const affordable = save.player.coins >= offer.cost;
      items.push(this.add.bitmapText(x + width - 14, rowY, Tex.font, `${offer.cost}`, 8).setOrigin(1, 0).setTint(affordable ? UiColor.coin : UiColor.danger));
      items.push(this.add.bitmapText(x + 38, rowY + 10, Tex.font, item.description, 8).setTint(UiColor.textFaint).setMaxWidth(width - 66));
    });
    const coinY = contentTop + SHOP_ITEMS.length * 25 + 6;
    items.push(this.add.image(x + 15, coinY, itemTexture('coin')).setOrigin(0, 0.5));
    items.push(this.add.bitmapText(x + 27, coinY - 4, Tex.font, `${save.player.coins}`, 8).setTint(UiColor.coin));
    container.add(items);
    this.panel = container;
  }

  private renderQuests(): void {
    const save = getSession().save;
    const width = Math.min(this.w - 32, 304);
    const height = Math.min(this.h - 28, 174);
    const { container, items, x, contentTop } = this.beginModal('QUEST LOG', width, height, SettingsStore.keyLabel('pause'));
    let y = contentTop;
    let any = false;
    for (const quest of Object.values(QUESTS)) {
      const progress = save.quests[quest.id];
      if (!progress || progress.status === 'locked') continue;
      any = true;
      const complete = progress.status === 'completed' || progress.status === 'rewarded';
      items.push(this.add.bitmapText(x + 14, y, Tex.font, quest.title, 8).setTint(complete ? UiColor.good : UiColor.emberBright));
      items.push(this.add.bitmapText(x + width - 14, y, Tex.font, complete ? 'DONE' : 'ACTIVE', 8).setOrigin(1, 0).setTint(complete ? UiColor.good : UiColor.textDim));
      y += 13;
      for (const objective of quest.objectives) {
        const amount = progress.objectives[objective.id] ?? 0;
        const done = amount >= objective.count;
        items.push(this.add.rectangle(x + 21, y + 4, 4, 4, done ? 0xa8d08a : 0x7f7568).setOrigin(0.5));
        items.push(
          this.add
            .bitmapText(x + 30, y, Tex.font, `${objective.label}   ${Math.min(amount, objective.count)}/${objective.count}`, 8)
            .setTint(done ? UiColor.textFaint : UiColor.text)
            .setMaxWidth(width - 50),
        );
        y += 11;
      }
      y += 7;
    }
    if (!any) {
      items.push(this.add.bitmapText(x + 14, contentTop, Tex.font, 'No quests yet. Speak with the villagers.', 8).setTint(UiColor.textDim).setMaxWidth(width - 28));
    }
    container.add(items);
    this.panel = container;
  }

  private openPause(): void {
    if (!hasSession()) return;
    this.closePanel(false);
    this.closeDialogue(false);
    this.setWorldLocked(true);
    this.modalReadyAt = this.time.now + 160;
    this.releaseMenu?.open('pause');
  }

  private moveList(direction: number): void {
    const count = this.panelKind === 'shop' ? SHOP_ITEMS.length : getSession().save.inventory.length;
    if (!count) return;
    this.listIndex = (this.listIndex + direction + count * 2) % count;
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

  private closePanel(unlock = true): void {
    this.panel?.destroy(true);
    this.panel = null;
    this.panelKind = null;
    if (unlock) this.setWorldLocked(false);
  }

  private showSpecial(
    title: string,
    body: string,
    action: () => void,
    tint: number,
    choices: Array<{ label: string; action: () => void }> = [],
    selectedIndex = 0,
  ): void {
    this.closeDialogue(false);
    this.closePanel(false);
    this.closeSpecial(false);
    this.specialIndex = selectedIndex;
    this.setWorldLocked(true);
    this.modalReadyAt = this.time.now + 400;
    const width = Math.min(this.w - 40, 292);
    const height = choices.length ? 136 : 118;
    const x = Math.round((this.w - width) / 2);
    const y = Math.round((this.h - height) / 2);
    const shade = this.add.rectangle(0, 0, this.w, this.h, 0x07060b, 0.9).setOrigin(0, 0);
    const frame = new NinePanel(this, x, y, width, height, Tex.panelWood);
    const inner = new Plate(this, width - 14, height - 14, { radius: 2, fill: 0x161320, alpha: 0.96 });
    inner.setPosition(x + 7, y + 7);
    const heading = this.add.bitmapText(x + width / 2, y + 20, Tex.font, title, 8).setOrigin(0.5, 0).setTint(tint);
    heading.setLetterSpacing(2);
    const copy = this.add
      .bitmapText(x + width / 2, y + 44, Tex.font, body, 8)
      .setOrigin(0.5, 0)
      .setTint(UiColor.text)
      .setCenterAlign()
      .setMaxWidth(width - 34);
    const items: Phaser.GameObjects.GameObject[] = [shade, frame, inner, heading, copy];
    if (choices.length) {
      choices.forEach((choice, index) => {
        const rowY = y + height - 43 + index * 13;
        const selected = index === this.specialIndex;
        if (selected) items.push(this.add.image(x + 54, rowY + 4, Tex.arrowRight).setOrigin(0.5));
        items.push(this.add.bitmapText(x + width / 2, rowY, Tex.font, choice.label, 8).setOrigin(0.5, 0).setTint(selected ? UiColor.emberBright : UiColor.text));
      });
    } else {
      items.push(this.add.bitmapText(x + width / 2, y + height - 22, Tex.font, SettingsStore.hint(['interact']), 8).setOrigin(0.5, 0).setTint(UiColor.textFaint));
    }
    this.special = this.add.container(0, 0, items).setDepth(Depth.UI + 20);
    this.specialAction = action;
    this.specialChoices = choices;
    this.specialIndex = selectedIndex;
  }

  private closeSpecial(unlock = true): void {
    this.special?.destroy(true);
    this.special = null;
    this.specialAction = null;
    this.specialChoices = [];
    this.specialIndex = 0;
    if (unlock) this.setWorldLocked(false);
  }

  private moveSpecialChoice(direction: number): void {
    if (!this.specialChoices.length) return;
    // Re-rendering goes through showSpecial, which arms a fresh input delay; a cursor move must not pay it.
    const readyAt = this.modalReadyAt;
    this.specialIndex = (this.specialIndex + direction + this.specialChoices.length) % this.specialChoices.length;
    const choices = this.specialChoices;
    const action = this.specialAction ?? (() => undefined);
    const title = choices.length ? 'EMBER RESTORED' : '';
    const save = hasSession() ? getSession().save : null;
    const minutes = save ? Math.max(1, Math.round(save.playtimeMs / 60000)) : 0;
    const body = save ? `Warm light returns to Kagehara.\nLV ${save.player.level}   ${save.player.coins} coins   ${minutes} min` : '';
    this.special?.destroy(true);
    this.special = null;
    this.sound.play(sfxKey('menu_move'), { volume: 0.25 });
    this.showSpecial(title, body, action, UiColor.ember, choices, this.specialIndex);
    this.modalReadyAt = readyAt;
  }

  private modalHint(actions: Array<'up' | 'down' | 'interact' | 'pause'>): string {
    return actions.map((action) => SettingsStore.keyLabel(action)).join('  ');
  }

  private async saveAndQuitToTitle(): Promise<boolean> {
    const world = this.scene.get('WorldScene') as (WorldScene & { saveCurrent?: () => Promise<boolean> }) | null;
    if (!world || !this.scene.isActive('WorldScene')) return false;
    try {
      if (world.saveCurrent) {
        const saved = await world.saveCurrent();
        if (!saved) return false;
      } else {
        await world.autosave();
      }
      this.closeSpecial(false);
      this.releaseMenu?.destroy();
      world.endSession();
      this.scene.stop('WorldScene');
      this.scene.start('MainMenuScene');
      return true;
    } catch (error) {
      console.error('[SaveSystem] Save & Quit failed', error);
      this.showToast('Save failed. Try again.');
      return false;
    }
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
        if (!this.dialogue && !this.panel && !this.special && !this.releaseMenu?.active && this.scene.isActive('WorldScene')) world.inputActions.setEnabled(true);
      });
    }
  }

  private displayName(id: string): string {
    return id.split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
  }
}
