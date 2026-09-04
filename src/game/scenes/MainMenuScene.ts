import Phaser from 'phaser';
import { ASSET_ROOT, Tex, musicKey, sfxKey } from '../config/assets';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/constants';
import { InputActions } from '../input/InputActions';
import { startNewSession } from '../core/session';
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

    // title
    const title = this.add.bitmapText(cx, 64, Tex.font, 'EMBERFALL', 24).setOrigin(0.5).setTint(0xf0b45a);
    title.setLetterSpacing(3);
    this.add.bitmapText(cx, 90, Tex.font, 'the ember of kagehara', 8).setOrigin(0.5).setTint(0x9a8f80);

    this.entries = [
      { label: 'New Game', enabled: true, action: () => this.newGame() },
      { label: 'Continue', enabled: false, action: () => undefined },
      { label: 'Settings', enabled: false, action: () => undefined },
    ];
    const panelW = 140;
    const panelH = 16 + this.entries.length * 16;
    new NinePanel(this, cx - panelW / 2, 128, panelW, panelH, Tex.panelDark);
    this.labels = this.entries.map((e, i) =>
      this.add
        .bitmapText(cx, 136 + i * 16 + 4, Tex.font, e.label, 8)
        .setOrigin(0.5, 0)
        .setTint(e.enabled ? 0xf2ead8 : 0x6d6358),
    );
    this.cursor = this.add.image(cx - 52, 140, Tex.arrowRight).setOrigin(0.5);
    this.add.bitmapText(cx, GAME_HEIGHT - 22, Tex.font, 'arrows/wasd move   j attack   k roll   e talk', 8).setOrigin(0.5).setTint(0x6d6358);
    this.add.bitmapText(cx, GAME_HEIGHT - 12, Tex.font, 'art: ninja adventure by pixel-boy & aaa (cc0)', 8).setOrigin(0.5).setTint(0x4d453d);

    this.input2 = new InputActions(this);
    this.moveCursor(0);

    this.playTitleMusic();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.input2.destroy());
  }

  private playTitleMusic(): void {
    const key = musicKey('title');
    if (!this.cache.audio.exists(key)) return;
    const existing = this.sound.get(key);
    if (existing?.isPlaying) return;
    const music = this.sound.add(key, { loop: true, volume: 0.5 });
    if (this.sound.locked) this.sound.once(Phaser.Sound.Events.UNLOCKED, () => music.play());
    else music.play();
  }

  private moveCursor(dir: number): void {
    const n = this.entries.length;
    let i = this.index;
    for (let k = 0; k < n; k++) {
      i = (i + dir + n) % n;
      if (this.entries[i]?.enabled) break;
    }
    if (dir !== 0 && i !== this.index) this.sound.play(sfxKey('menu_move'), { volume: 0.5 });
    this.index = i;
    const label = this.labels[i];
    if (label) this.cursor.setY(label.y + 4);
    this.tweens.killTweensOf(this.cursor);
    this.tweens.add({ targets: this.cursor, x: { from: this.cursor.x - 2, to: this.cursor.x }, duration: 400, yoyo: true, repeat: -1 });
  }

  private newGame(): void {
    if (this.busy) return;
    this.busy = true;
    this.sound.play(sfxKey('menu_accept'), { volume: 0.6 });
    startNewSession();
    this.sound.stopByKey(musicKey('title'));
    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start('WorldScene', { mapId: 'village', spawnId: 'start' });
    });
  }

  override update(time: number): void {
    this.input2.update(time);
    if (this.busy) return;
    if (this.input2.pressed('menuDown')) this.moveCursor(1);
    if (this.input2.pressed('menuUp')) this.moveCursor(-1);
    if (this.input2.pressed('confirm')) this.entries[this.index]?.action();
  }
}
