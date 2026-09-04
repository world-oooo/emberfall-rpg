import Phaser from 'phaser';
import { ASSET_ROOT, Tex } from '../config/assets';
import { SettingsStore } from '../systems/SettingsStore';

/** Loads the handful of files the loading screen itself needs, then hands over to PreloadScene. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload(): void {
    this.load.setPath(ASSET_ROOT);
    this.load.image(Tex.font, 'fonts/font8x8.png');
    this.load.image(Tex.panel, 'ui/panel.png');
    this.load.image(Tex.panelDark, 'ui/panel_bg_2.png');
  }

  create(): void {
    // Bitmap font from the pack's 8x8 sheet: ASCII from space, 15 glyphs per row.
    const fontConfig: Phaser.Types.GameObjects.BitmapText.RetroFontConfig = {
      image: Tex.font,
      width: 8,
      height: 8,
      chars: Phaser.GameObjects.RetroFont.TEXT_SET1,
      charsPerRow: 15,
      'offset.x': 0,
      'offset.y': 0,
      'spacing.x': 0,
      'spacing.y': 0,
      lineSpacing: 2,
    };
    this.cache.bitmapFont.add(Tex.font, Phaser.GameObjects.RetroFont.Parse(this, fontConfig));

    SettingsStore.load();
    this.sound.volume = SettingsStore.get().masterVolume;
    this.sound.pauseOnBlur = true;

    this.scene.start('PreloadScene');
  }
}
