import Phaser from 'phaser';
import { Depth } from '../config/constants';
import { Tex } from '../config/assets';
import type { WorldScene } from '../scenes/WorldScene';

/** ?debug=1 overlay: fps, player state/position, body outlines. DEV builds only. */
export class DebugOverlay {
  private readonly text: Phaser.GameObjects.BitmapText;

  constructor(private readonly scene: WorldScene) {
    this.text = scene.add.bitmapText(2, 36, Tex.font, '', 8).setScrollFactor(0).setDepth(Depth.Overlay).setTint(0x7fffd4);
    scene.physics.world.drawDebug = true;
    scene.physics.world.createDebugGraphic();
    scene.physics.world.debugGraphic.setDepth(Depth.Overlay - 1);
  }

  update(): void {
    const p = this.scene.player;
    const cam = this.scene.cameras.main;
    this.text.setText(
      [
        `fps ${Math.round(this.scene.game.loop.actualFps)}  map ${this.scene.mapDef.id}`,
        `pos ${Math.round(p.x)},${Math.round(p.y)}  vel ${Math.round(p.body.velocity.x)},${Math.round(p.body.velocity.y)}`,
        `state ${p.fsm.name}  face ${p.facing}  cam ${cam.scrollX},${cam.scrollY}`,
      ].join('\n'),
    );
  }

  destroy(): void {
    this.text.destroy();
    // the physics world may already be gone when the scene shuts down
    const world = this.scene.physics?.world as Phaser.Physics.Arcade.World | null | undefined;
    if (world) {
      world.drawDebug = false;
      world.debugGraphic?.destroy();
    }
  }
}
