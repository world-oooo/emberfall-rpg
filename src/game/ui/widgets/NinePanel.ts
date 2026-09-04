import Phaser from 'phaser';

/** Nine-slice panel from a 16x16 pack theme tile (4 px borders). */
export class NinePanel extends Phaser.GameObjects.NineSlice {
  constructor(scene: Phaser.Scene, x: number, y: number, width: number, height: number, texture: string, border = 5) {
    super(scene, x, y, texture, undefined, width, height, border, border, border, border);
    this.setOrigin(0, 0);
    scene.add.existing(this);
  }
}
