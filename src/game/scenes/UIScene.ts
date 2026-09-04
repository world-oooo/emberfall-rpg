import Phaser from 'phaser';
import { Tex } from '../config/assets';
import { Depth } from '../config/constants';
import { getSession } from '../core/session';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/constants';
import { NinePanel } from '../ui/widgets/NinePanel';

/** Parallel overlay scene: HUD now; dialogue/inventory/quest/pause in later milestones. */
export class UIScene extends Phaser.Scene {
  private hearts: Phaser.GameObjects.Image[] = [];
  private mapLabel!: Phaser.GameObjects.BitmapText;
  private banner: Phaser.GameObjects.BitmapText | null = null;
  private toast: Phaser.GameObjects.Container | null = null;

  constructor() {
    super('UIScene');
  }

  create(): void {
    this.cameras.main.setRoundPixels(true);
    this.mapLabel = this.add.bitmapText(8, 20, Tex.font, '', 8).setTint(0xd9d2c5).setDepth(Depth.UI).setAlpha(0.85);
    this.refreshHearts();
    this.events.on(Phaser.Scenes.Events.WAKE, () => this.refreshHearts());
  }

  refreshHearts(): void {
    for (const h of this.hearts) h.destroy();
    this.hearts = [];
    const save = getSession().save;
    const total = Math.ceil(save.player.maxHp / 2);
    for (let i = 0; i < total; i++) {
      const hpForHeart = save.player.hp - i * 2;
      const frame = hpForHeart >= 2 ? 4 : hpForHeart === 1 ? 2 : 0;
      const img = this.add.image(8 + i * 14, 8, Tex.hearts, frame).setOrigin(0, 0).setDepth(Depth.UI);
      this.hearts.push(img);
    }
  }

  setMapLabel(text: string): void {
    this.mapLabel.setText(text);
  }

  /** Area name that fades in at the top centre when a map loads. */
  showMapName(name: string): void {
    this.banner?.destroy();
    const t = this.add.bitmapText(GAME_WIDTH / 2, 30, Tex.font, name.toUpperCase(), 8).setOrigin(0.5).setTint(0xf0b45a).setDepth(Depth.UI).setAlpha(0);
    t.setLetterSpacing(2);
    this.banner = t;
    this.tweens.add({ targets: t, alpha: 1, duration: 400, delay: 300, yoyo: true, hold: 1600, onComplete: () => t.destroy() });
  }

  /** Short message at the bottom (locked door, pickup, hint). */
  showToast(text: string): void {
    this.toast?.destroy();
    const w = Math.max(60, text.length * 8 + 16);
    const panel = new NinePanel(this, 0, 0, w, 20, Tex.panelDark);
    const label = this.add.bitmapText(w / 2, 6, Tex.font, text, 8).setOrigin(0.5, 0).setTint(0xf2ead8);
    const c = this.add.container(Math.round(GAME_WIDTH / 2 - w / 2), GAME_HEIGHT - 40, [panel, label]).setDepth(Depth.UI).setAlpha(0);
    this.toast = c;
    this.tweens.add({ targets: c, alpha: 1, duration: 150, yoyo: true, hold: 1400, onComplete: () => { c.destroy(); if (this.toast === c) this.toast = null; } });
  }
}
