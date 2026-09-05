import Phaser from 'phaser';
import { ASSET_ROOT, Tex, musicKey, sfxKey } from '../config/assets';
import { Display } from '../systems/DisplaySystem';
import { startNewSession, type SaveGame } from '../core/session';
import { InputActions } from '../input/InputActions';
import { SaveSystem } from '../systems/SaveSystem';
import { SettingsStore } from '../systems/SettingsStore';
import { NinePanel } from '../ui/widgets/NinePanel';
import { Plate } from '../ui/widgets/Plate';
import { ReleaseMenu } from '../ui/ReleaseMenu';
import { titleVignette } from '../ui/TitleVignette';
import { MAPS } from '../data/maps';
import { gameEvents } from '../core/events';

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
  private releaseMenu!: ReleaseMenu;
  private saveStatus = '';
  private slotLoaded = false;
  private slotLoad: Promise<void> = Promise.resolve();
  private readonly saves = new SaveSystem();

  constructor() {
    super('MainMenuScene');
  }

  preload(): void {
    this.load.setPath(ASSET_ROOT);
    if (!this.textures.exists('title_nature')) this.load.spritesheet('title_nature', 'tiles/TilesetNature.png', { frameWidth: 16, frameHeight: 16, margin: 1, spacing: 2 });
    if (!this.textures.exists('title_house')) this.load.spritesheet('title_house', 'tiles/TilesetHouse.png', { frameWidth: 16, frameHeight: 16, margin: 1, spacing: 2 });
    if (!this.cache.audio.exists(musicKey('title'))) this.load.audio(musicKey('title'), 'audio/music/title.ogg');
  }

  create(): void {
    this.busy = false;
    this.index = 0;
    this.slotLoaded = false;
    this.continueSave = null;
    this.saveStatus = '';
    Display.applyToCamera(this.cameras.main);
    this.entries = [
      { label: 'New Game', enabled: true, action: () => this.newGame() },
      // Selectable while the save slot is still being read, so a quick Down+Enter after a reload lands on
      // Continue instead of skipping it to Options. loadContinueSlot() greys it only if there is no save.
      { label: 'Continue', enabled: true, action: () => this.continueGame() },
      { label: 'Options', enabled: true, action: () => this.releaseMenu.open('options') },
      { label: 'Controls', enabled: true, action: () => this.releaseMenu.open('controls') },
      { label: 'Credits', enabled: true, action: () => this.releaseMenu.open('credits') },
    ];
    this.buildMenu();
    this.input2 = new InputActions(this);
    this.releaseMenu = new ReleaseMenu(this, this.input2, { allowImport: true, saveSystem: this.saves, onSaveChanged: () => void this.loadContinueSlot() });
    this.moveCursor(0);
    gameEvents.emit('bootMenuReady', { at: performance.now() });
    this.playTitleMusic();
    const stopAudioSettings = SettingsStore.onChange(settings => {
      this.sound.volume = settings.masterVolume;
      const music = this.sound.get(musicKey('title'));
      if (music) (music as Phaser.Sound.WebAudioSound).setVolume(settings.musicVolume);
    });
    this.slotLoad = this.loadContinueSlot();
    const stopWatching = Display.onChange(() => {
      Display.applyToCamera(this.cameras.main);
      this.buildMenu();
      this.moveCursor(0);
      this.releaseMenu.resize();
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      stopWatching();
      stopAudioSettings();
      this.releaseMenu.destroy();
      this.input2.destroy();
      this.root = null;
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

    items.push(titleVignette(this, w, h));
    const titleY = Math.max(19, Math.round(h * 0.16));
    const title = this.add.bitmapText(cx, titleY, Tex.font, 'EMBERFALL', 16).setOrigin(0.5).setTint(0xf0b45a);
    title.setLetterSpacing(2);
    items.push(title);
    items.push(this.add.bitmapText(cx, titleY + 19, Tex.font, 'the ember of kagehara', 8).setOrigin(0.5).setTint(0xb7a498));
    const panelW = 146;
    const rowH = 14;
    const panelH = 16 + this.entries.length * rowH;
    const panelY = Math.max(titleY + 32, Math.round(h / 2 - panelH / 2 + 14));
    const menuFrame = new NinePanel(this, cx - panelW / 2, panelY, panelW, panelH, Tex.panelWood);
    const menuInner = new Plate(this, panelW - 14, panelH - 14, { radius: 2, fill: 0x191621, alpha: 0.95 });
    menuInner.setPosition(cx - panelW / 2 + 7, panelY + 7);
    items.push(menuFrame, menuInner);
    this.labels = this.entries.map((entry, i) =>
      this.add.bitmapText(cx, panelY + 10 + i * rowH, Tex.font, entry.label, 8).setOrigin(0.5, 0).setTint(entry.enabled ? 0xf2ead8 : 0x6d6358),
    );
    items.push(...this.labels);
    this.cursor = this.add.image(cx - 55, panelY + 14, Tex.arrowRight).setOrigin(0.5);
    items.push(this.cursor);
    const save = this.continueSave;
    const minutes = save ? Math.floor(save.playtimeMs / 60000) : 0;
    const footer = this.saveStatus || (save ? `${MAPS[save.player.mapId]?.displayName ?? save.player.mapId}  LV ${save.player.level}  ${minutes}m` : 'A small journey. A lasting ember.');
    items.push(this.add.bitmapText(cx, h - 15, Tex.font, footer, 8).setOrigin(0.5).setTint(0xb7a498).setMaxWidth(w - 20).setCenterAlign());
    this.root = this.add.container(0, 0, items);
  }

  override update(time: number): void {
    this.input2.update(time);
    if (this.busy) return;
    if (this.releaseMenu.active) {
      this.releaseMenu.update(time);
      return;
    }
    if (this.input2.pressed('menuDown')) this.moveCursor(1);
    if (this.input2.pressed('menuUp')) this.moveCursor(-1);
    if (this.input2.pressed('confirm')) this.entries[this.index]?.action();
  }

  /** Label of the highlighted row (release submenu if open, else the title entry), for DEV/test navigation. */
  getSelectionLabel(): string | null {
    if (this.releaseMenu?.active) return this.releaseMenu.selectionLabel;
    return this.entries[this.index]?.label ?? null;
  }

  private async loadContinueSlot(): Promise<void> {
    try {
      this.continueSave = await this.saves.load();
    } catch (error) {
      this.saveStatus = 'Save unreadable. See Options > Save Data.';
      void error;
      this.continueSave = null;
    }
    if (!this.scene.isActive()) return;
    this.slotLoaded = true;
    const entry = this.entries[1];
    const label = this.labels[1];
    if (entry) entry.enabled = this.continueSave !== null;
    label?.setTint(this.continueSave ? 0xf2ead8 : 0x6d6358);
    this.buildMenu();
    this.moveCursor(0);
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
    if (!this.slotLoaded) {
      // The save slot is still being read. Queue the press instead of dropping it: a player who hits Enter the
      // moment the title appears expects the game to start, and the overwrite warning still gets its chance.
      if (this.busy) return;
      this.busy = true;
      void this.slotLoad.then(() => {
        this.busy = false;
        if (this.scene.isActive()) this.newGame();
      });
      return;
    }
    const begin = () => { startNewSession(); this.startGame(false); };
    if (this.continueSave || this.saveStatus) {
      this.releaseMenu.confirm('NEW JOURNEY', 'Existing progress will be replaced after the new journey saves.', begin, () => this.releaseMenu.destroy());
    } else begin();
  }

  private continueGame(): void {
    if (!this.slotLoaded) {
      // Chosen before the save read finished: wait for it, then decide. Mirrors newGame()'s deferral.
      if (this.busy) return;
      this.busy = true;
      void this.slotLoad.then(() => {
        this.busy = false;
        if (this.scene.isActive()) this.continueGame();
      });
      return;
    }
    if (!this.continueSave) {
      // Slot loaded and empty: keep the player on the menu rather than doing nothing silently.
      this.moveCursor(0);
      return;
    }
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

}
