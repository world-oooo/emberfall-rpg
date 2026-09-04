import Phaser from 'phaser';
import { Actor } from '../Actor';
import { npcTexture } from '../../config/assets';
import { FACING_COL, type Facing } from '../player/heroAnimations';

export interface NpcSpawnConfig {
  npcId: string;
  facing: Facing;
  x: number;
  y: number;
}

/**
 * Villager: 16x16 pack Walk sheet (64x64). Columns = down/up/left/right; rows 0-3 walk frames (row 0 = idle pose).
 * Stands still with a soft idle bob; turns to face the player when spoken to (M5).
 */
export class Npc extends Actor {
  readonly npcId: string;
  facing: Facing;

  constructor(scene: Phaser.Scene, cfg: NpcSpawnConfig) {
    super(scene, cfg.x, cfg.y, {
      texture: npcTexture(cfg.npcId),
      frame: FACING_COL[cfg.facing],
      body: { width: 10, height: 8, offsetX: 3, offsetY: 8 },
      shadow: true,
      shadowOffsetY: -1,
    });
    this.npcId = cfg.npcId;
    this.facing = cfg.facing;
    this.body.setImmovable(true);
    this.body.moves = false;
    this.sprite.setName(`npc:${cfg.npcId}`);
    this.ensureAnimations();
    this.sprite.play(this.animKey('idle', this.facing));
  }

  private animKey(kind: 'idle' | 'walk', facing: Facing): string {
    return `${npcTexture(this.npcId)}_${kind}_${facing}`;
  }

  private ensureAnimations(): void {
    const tex = npcTexture(this.npcId);
    const anims = this.scene.anims;
    for (const f of ['down', 'up', 'left', 'right'] as Facing[]) {
      const col = FACING_COL[f];
      const idleKey = this.animKey('idle', f);
      if (!anims.exists(idleKey)) {
        // two-frame breathing: stand + first walk frame, slow
        anims.create({ key: idleKey, frames: [{ key: tex, frame: col }], frameRate: 1, repeat: 0 });
      }
      const walkKey = this.animKey('walk', f);
      if (!anims.exists(walkKey)) {
        anims.create({ key: walkKey, frames: [0, 1, 2, 3].map((r) => ({ key: tex, frame: r * 4 + col })), frameRate: 8, repeat: -1 });
      }
    }
  }

  setFacing(f: Facing): void {
    if (f === this.facing) return;
    this.facing = f;
    this.sprite.play(this.animKey('idle', f));
  }

  /** Turn toward a world point (used when the player talks to the NPC). */
  faceToward(x: number, y: number): void {
    const dx = x - this.x;
    const dy = y - this.y;
    if (Math.abs(dx) > Math.abs(dy)) this.setFacing(dx > 0 ? 'right' : 'left');
    else this.setFacing(dy > 0 ? 'down' : 'up');
  }
}
