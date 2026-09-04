import Phaser from 'phaser';
import { ASSET_ROOT, Tex, musicKey, sfxKey } from '../config/assets';
import { Display } from '../systems/DisplaySystem';
import { startNewSession, type SaveGame } from '../core/session';
import { InputActions } from '../input/InputActions';
import { SaveSystem } from '../systems/SaveSystem';
import { SettingsStore } from '../systems/SettingsStore';
import { NinePanel } from '../ui/widgets/NinePanel';
import { Plate } from '../ui/widgets/Plate';

interface MenuEntry {
  label: string;
  enabled: boolean;
  action: () => void;
}

export class MainMenuScene extends Phaser.Scene {
  private input2!: InputActions;
  private entries: MenuEntry[] = [];
  private labels: Phaser.GameObjects.BitmapText[] = [];
  private cursor!: Phaser.GameObjects.Image;
  private index = 0;
  private busy = false;
  private root: Phaser.GameObjects.Container | null = null;
  private continueSave: SaveGame | null = null;
  private settingsPanel: Phaser.GameObjects.Container | null = null;
  private settingsIndex = 0;
  private readonly saves = new SaveSystem();

  constructor() {
    super('MainMenuScene');
  }

  preload(): void {
    this.load.setPath(ASSET_ROOT);
    if (!this.cache.audio.exists(musicKey('title'))) this.load.audio(musicKey('title'), 'audio/music/title.ogg');
  }

  create(): void {
    this.busy = false;
    Display.applyToCamera(this.cameras.main);
    this.entries = [
      { label: 'New Game', enabled: true, action: () => this.newGame() },
      { label: 'Continue', enabled: false, action: () => this.continueGame() },
      { label: 'Settings', enabled: true, action: () => this.openSettings() },
    ];
    this.buildMenu();
    this.input2 = new InputActions(this);
    this.moveCursor(0);
    this.playTitleMusic();
    void this.loadContinueSlot();
    const stopWatching = Display.onChange(() => {
      Display.applyToCamera(this.cameras.main);
      this.buildMenu();
      this.moveCursor(0);
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      stopWatching();
      this.input2.destroy();
    });
  }

  /** Rebuilt whenever the window changes so the title block stays centred at any size. */
  private buildMenu(): void {
    this.root?.destroy(true);
    const w = Display.width;
    const h = Display.height;
    const cx = Math.round(w / 2);
    const items: Phaser.GameObjects.GameObject[] = [];
    items.push(this.add.rectangle(0, 0, w, h, 0x0b0a12).setOrigin(0, 0));

    // A soft ember glow behind the title gives the menu some depth without new art.
    const glow = this.add.graphics();
    glow.fillStyle(0x3a2416, 0.55);
    glow.fillCircle(cx, Math.round(h * 0.3), Math.round(Math.min(w, h) * 0.38));
    glow.fillStyle(0x5a3218, 0.4);
    glow.fillCircle(cx, Math.round(h * 0.3), Math.round(Math.min(w, h) * 0.24));
    items.push(glow);

    const titleY = Math.round(h * 0.22);
    const title = this.add.bitmapText(cx, titleY, Tex.font, 'EMBERFALL', 24).setOrigin(0.5).setTint(0xf0b45a);
    title.setLetterSpacing(3);
    items.push(title);
    items.push(this.add.bitmapText(cx, titleY + 30, Tex.font, 'the ember of kagehara', 8).setOrigin(0.5).setTint(0x9a8f80));
    items.push(this.add.bitmapText(cx, titleY + 46, Tex.font, 'a compact action rpg', 8).setOrigin(0.5).setTint(0x665d55));

    const panelW = 148;
    const panelH = 18 + this.entries.length * 17;
    const panelY = Math.round(h * 0.52);
    const menuFrame = new NinePanel(this, cx - panelW / 2, panelY, panelW, panelH, Tex.panelWood);
    const menuInner = new Plate(this, panelW - 14, panelH - 14, { radius: 2, fill: 0x191621, alpha: 0.95 });
    menuInner.setPosition(cx - panelW / 2 + 7, panelY + 7);
    items.push(menuFrame, menuInner);
    this.labels = this.entries.map((entry, i) =>
      this.add.bitmapText(cx, panelY + 10 + i * 17, Tex.font, entry.label, 8).setOrigin(0.5, 0).setTint(entry.enabled ? 0xf2ead8 : 0x6d6358),
    );
    items.push(...this.labels);
    this.cursor = this.add.image(cx - 55, panelY + 14, Tex.arrowRight).setOrigin(0.5);
    items.push(this.cursor);

    items.push(this.add.bitmapText(cx, h - 34, Tex.font, 'MOVE WASD   ATTACK J   ROLL K   THROW L', 8).setOrigin(0.5).setTint(0x74695f));
    items.push(this.add.bitmapText(cx, h - 23, Tex.font, 'TALK E   BAG I   QUESTS Q   PAUSE ESC', 8).setOrigin(0.5).setTint(0x61584f));
    items.push(this.add.bitmapText(cx, h - 12, Tex.font, 'ART: NINJA ADVENTURE - PIXEL-BOY & AAA', 8).setOrigin(0.5).setTint(0x4d453d));
    this.root = this.add.container(0, 0, items);
  }

  override update(time: number): void {
    this.input2.update(time);
    if (this.busy) return;
    if (this.settingsPanel) {
      if (this.input2.pressed('menuDown')) this.moveSetting(1);
      if (this.input2.pressed('menuUp')) this.moveSetting(-1);
      if (this.input2.pressed('menuLeft')) this.adjustSetting(-1);
      if (this.input2.pressed('menuRight') || this.input2.pressed('confirm')) this.adjustSetting(1);
      if (this.input2.pressed('cancel')) this.closeSettings();
      return;
    }
    if (this.input2.pressed('menuDown')) this.moveCursor(1);
    if (this.input2.pressed('menuUp')) this.moveCursor(-1);
    if (this.input2.pressed('confirm')) this.entries[this.index]?.action();
  }

  private async loadContinueSlot(): Promise<void> {
    try {
      this.continueSave = await this.saves.load();
    } catch (error) {
      console.warn('[SaveSystem] Existing save could not be loaded', error);
      this.continueSave = null;
    }
    if (!this.scene.isActive()) return;
    const entry = this.entries[1];
    const label = this.labels[1];
    if (entry) entry.enabled = this.continueSave !== null;
    label?.setTint(this.continueSave ? 0xf2ead8 : 0x6d6358);
    if (!this.entries[this.index]?.enabled) this.moveCursor(1);
  }

  private playTitleMusic(): void {
    const key = musicKey('title');
    if (!this.cache.audio.exists(key)) return;
    const existing = this.sound.get(key);
    if (existing?.isPlaying) return;
    const music = this.sound.add(key, { loop: true, volume: SettingsStore.get().musicVolume });
    if (this.sound.locked) this.sound.once(Phaser.Sound.Events.UNLOCKED, () => music.play());
    else music.play();
  }

  private moveCursor(direction: number): void {
    const count = this.entries.length;
    let next = this.index;
    for (let attempt = 0; attempt < count; attempt += 1) {
      next = (next + direction + count) % count;
      if (this.entries[next]?.enabled) break;
    }
    if (direction !== 0 && next !== this.index) this.sound.play(sfxKey('menu_move'), { volume: 0.5 });
    this.index = next;
    const label = this.labels[next];
    if (label) this.cursor.setY(label.y + 4);
    this.tweens.killTweensOf(this.cursor);
    this.tweens.add({ targets: this.cursor, x: { from: this.cursor.x - 2, to: this.cursor.x }, duration: 400, yoyo: true, repeat: -1 });
  }

  private newGame(): void {
    startNewSession();
    this.startGame(false);
  }

  private continueGame(): void {
    if (!this.continueSave) return;
    startNewSession(structuredClone(this.continueSave));
    this.startGame(true);
  }

  private startGame(resume: boolean): void {
    if (this.busy) return;
    this.busy = true;
    this.sound.play(sfxKey('menu_accept'), { volume: 0.6 });
    this.sound.stopByKey(musicKey('title'));
    const save = this.continueSave;
    const mapId = resume && save ? save.player.mapId : 'village';
    const spawnId = resume && save ? save.player.spawnId : 'start';
    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('WorldScene', { mapId, spawnId, resume }));
  }

  private openSettings(): void {
    this.settingsIndex = 0;
    this.renderSettings();
    this.sound.play(sfxKey('menu_accept'), { volume: 0.35 });
  }

  private renderSettings(): void {
    this.settingsPanel?.destroy(true);
    const settings = SettingsStore.get();
    const rows = [
      `Master Volume  ${Math.round(settings.masterVolume * 100)}%`,
      `Music Volume   ${Math.round(settings.musicVolume * 100)}%`,
      `Screen Shake   ${settings.screenShake ? 'ON' : 'OFF'}`,
      'Back',
    ];
    const panel = new NinePanel(this, 0, 0, 300, 142, Tex.panelWood);
    const title = this.add.bitmapText(150, 14, Tex.font, 'SETTINGS', 16).setOrigin(0.5, 0).setTint(0xf0b45a);
    const body = this.add.bitmapText(36, 47, Tex.font, rows.map((row, i) => `${i === this.settingsIndex ? '>' : ' '} ${row}`).join('\n\n'), 8).setTint(0xf2ead8);
    const hint = this.add.bitmapText(150, 122, Tex.font, 'ARROWS / E / ESC', 8).setOrigin(0.5, 0).setTint(0x8a7e72);
    this.settingsPanel = this.add.container(90, 64, [panel, title, body, hint]).setDepth(20);
  }

  private moveSetting(direction: number): void {
    this.settingsIndex = (this.settingsIndex + direction + 4) % 4;
    this.sound.play(sfxKey('menu_move'), { volume: 0.3 });
    this.renderSettings();
  }

  private adjustSetting(direction: number): void {
    const current = SettingsStore.get();
    if (this.settingsIndex === 0) {
      const volume = Phaser.Math.Clamp(Math.round((current.masterVolume + direction * 0.1) * 10) / 10, 0, 1);
      SettingsStore.set({ masterVolume: volume });
      this.sound.volume = volume;
    } else if (this.settingsIndex === 1) {
      const volume = Phaser.Math.Clamp(Math.round((current.musicVolume + direction * 0.1) * 10) / 10, 0, 1);
      SettingsStore.set({ musicVolume: volume });
      const titleMusic = this.sound.get(musicKey('title'));
      titleMusic?.stop();
      titleMusic?.destroy();
      this.playTitleMusic();
    } else if (this.settingsIndex === 2) SettingsStore.set({ screenShake: !current.screenShake });
    else {
      this.closeSettings();
      return;
    }
    this.sound.play(sfxKey('menu_accept'), { volume: 0.3 });
    this.renderSettings();
  }

  private closeSettings(): void {
    this.settingsPanel?.destroy(true);
    this.settingsPanel = null;
    this.sound.play(sfxKey('menu_cancel'), { volume: 0.3 });
  }
}
