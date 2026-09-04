import Phaser from 'phaser';
import { ASSET_ROOT, Tex, musicKey, sfxKey } from '../config/assets';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/constants';
import { startNewSession, type SaveGame } from '../core/session';
import { InputActions } from '../input/InputActions';
import { SaveSystem } from '../systems/SaveSystem';
import { SettingsStore } from '../systems/SettingsStore';
import { NinePanel } from '../ui/widgets/NinePanel';

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
    this.cameras.main.setRoundPixels(true);
    const cx = GAME_WIDTH / 2;
    this.add.rectangle(cx, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x0b0a12);

    const title = this.add.bitmapText(cx, 58, Tex.font, 'EMBERFALL', 24).setOrigin(0.5).setTint(0xf0b45a);
    title.setLetterSpacing(3);
    this.add.bitmapText(cx, 87, Tex.font, 'the ember of kagehara', 8).setOrigin(0.5).setTint(0x9a8f80);
    this.add.bitmapText(cx, 103, Tex.font, 'a compact action rpg', 8).setOrigin(0.5).setTint(0x665d55);

    this.entries = [
      { label: 'New Game', enabled: true, action: () => this.newGame() },
      { label: 'Continue', enabled: false, action: () => this.continueGame() },
      { label: 'Settings', enabled: true, action: () => this.openSettings() },
    ];
    const panelW = 140;
    const panelH = 16 + this.entries.length * 16;
    new NinePanel(this, cx - panelW / 2, 124, panelW, panelH, Tex.panelDark);
    this.labels = this.entries.map((entry, i) => this.add.bitmapText(cx, 132 + i * 16 + 4, Tex.font, entry.label, 8).setOrigin(0.5, 0).setTint(entry.enabled ? 0xf2ead8 : 0x6d6358));
    this.cursor = this.add.image(cx - 52, 136, Tex.arrowRight).setOrigin(0.5);
    this.add.bitmapText(cx, GAME_HEIGHT - 31, Tex.font, 'WASD/ARROWS MOVE   J ATTACK   K ROLL   E TALK', 8).setOrigin(0.5).setTint(0x74695f);
    this.add.bitmapText(cx, GAME_HEIGHT - 21, Tex.font, 'I INVENTORY   Q QUESTS   ESC PAUSE', 8).setOrigin(0.5).setTint(0x61584f);
    this.add.bitmapText(cx, GAME_HEIGHT - 11, Tex.font, 'ART: NINJA ADVENTURE BY PIXEL-BOY & AAA - CC0', 8).setOrigin(0.5).setTint(0x4d453d);

    this.input2 = new InputActions(this);
    this.moveCursor(0);
    this.playTitleMusic();
    void this.loadContinueSlot();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.input2.destroy());
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
