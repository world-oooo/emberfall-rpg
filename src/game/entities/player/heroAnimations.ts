import Phaser from 'phaser';
import { Anim, Tex } from '../../config/assets';

export type Facing = 'down' | 'up' | 'left' | 'right';
export const FACINGS: Facing[] = ['down', 'up', 'left', 'right'];

/** Column index in the pack's sheets: down, up, left, right. */
export const FACING_COL: Record<Facing, number> = { down: 0, up: 1, left: 2, right: 3 };

/** Frame indices for a 4-column sheet where rows are animation frames. */
function column(col: number, rows: number, columns = 4): number[] {
  const out: number[] = [];
  for (let r = 0; r < rows; r++) out.push(r * columns + col);
  return out;
}

export function registerHeroAnimations(scene: Phaser.Scene): void {
  const anims = scene.anims;
  const mk = (key: string, tex: string, frames: number[], frameRate: number, repeat: number) => {
    if (anims.exists(key)) return;
    anims.create({ key, frames: frames.map((frame) => ({ key: tex, frame })), frameRate, repeat });
  };
  for (const f of FACINGS) {
    const col = FACING_COL[f];
    mk(Anim.hero('idle', f), Tex.heroIdle, column(col, 4), 5, -1);
    mk(Anim.hero('walk', f), Tex.heroWalk, column(col, 4), 9, -1);
    mk(Anim.hero('attack', f), Tex.heroAttack, column(col, 4), 16, 0);
    mk(Anim.hero('roll', f), Tex.heroRoll, column(col, 3), 14, 0);
    mk(Anim.hero('hit', f), Tex.heroHit, column(col, 2), 10, 0);
    mk(Anim.weapon(f), Tex.weaponKatana, column(col, 4), 16, 0);
  }
  mk(Anim.heroDead, Tex.heroDead, [0, 1], 6, 0);
}

export function facingFromVector(x: number, y: number, current: Facing): Facing {
  if (x === 0 && y === 0) return current;
  if (Math.abs(x) > Math.abs(y)) return x > 0 ? 'right' : 'left';
  return y > 0 ? 'down' : 'up';
}

export const FACING_VEC: Record<Facing, { x: number; y: number }> = {
  down: { x: 0, y: 1 },
  up: { x: 0, y: -1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};
