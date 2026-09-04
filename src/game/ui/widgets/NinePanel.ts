import Phaser from 'phaser';

/**
 * Nine-slice panel from a 16x16 pack theme tile.
 *
 * The border must be 6, not 5: at 5 the stretched middle slice includes the inner bevel row of the source
 * texture, which is what produced the visible two-tone seam down the old inventory panel. At 6 the middle
 * slice is the flat interior colour only.
 */
export class NinePanel extends Phaser.GameObjects.NineSlice {
  constructor(scene: Phaser.Scene, x: number, y: number, width: number, height: number, texture: string, border = 6) {
    super(scene, x, y, texture, undefined, width, height, border, border, border, border);
    this.setOrigin(0, 0);
    scene.add.existing(this);
  }
}

/** Interior colours of the pack panels, for text tints that need to read against them. */
export const PanelColor = {
  wood: 0x8d977f,
  woodDark: 0x56634d,
  woodEdge: 0xf06733,
  cream: 0xf38c4c,
  white: 0xffffff,
  bgOlive: 0x46402e,
  bgGrey: 0x34312c,
} as const;

/** Shared text tints so every surface uses the same palette. */
export const UiColor = {
  ember: 0xf0b45a,
  emberBright: 0xffd08a,
  text: 0xf6efe0,
  textDim: 0xb9ae9c,
  textFaint: 0x7f7568,
  onWood: 0x2b2a21,
  onWoodDim: 0x4c4b3c,
  good: 0xa8d08a,
  danger: 0xe8695f,
  coin: 0xf5cf5a,
} as const;
