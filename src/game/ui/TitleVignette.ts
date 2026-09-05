import Phaser from 'phaser';
import { Tex } from '../config/assets';

/** A small scene from Kagehara, assembled from the same tiles used in the village. */
export function titleVignette(scene: Phaser.Scene, width: number, height: number): Phaser.GameObjects.Container {
  const items: Phaser.GameObjects.GameObject[] = [];
  const groundY = height - 20;
  const shrineX = Math.round(width / 2 - 115);
  const night = scene.add.graphics();
  night.fillStyle(0x141321, 1).fillRect(0, Math.round(height * 0.52), width, height);
  night.fillStyle(0x191829, 1).fillTriangle(0, height * 0.65, width * 0.25, height * 0.34, width * 0.6, height * 0.8);
  night.fillStyle(0x1d1a29, 1).fillTriangle(width * 0.4, height * 0.8, width * 0.76, height * 0.37, width, height * 0.67);
  night.fillStyle(0x10111b, 1).fillRect(0, groundY, width, 20);
  items.push(night);

  const tileBlock = (texture: string, frames: number[][], x: number, y: number, tint: number, scale = 1) => {
    frames.forEach((row, r) => row.forEach((frame, c) => {
      if (frame < 0) return;
      items.push(scene.add.image(x + c * 16 * scale, y + r * 16 * scale, texture, frame).setOrigin(0).setTint(tint).setScale(scale));
    }));
  };
  tileBlock('title_nature', [[2, 3], [26, 27]], 1, groundY - 58, 0x36364d, 2);
  tileBlock('title_nature', [[2, 3], [26, 27]], width - 59, groundY - 77, 0x333247, 2);
  tileBlock('title_nature', [[-1, 53, 54, -1], [76, 77, 78, 79], [100, 101, 102, 103]], width - 96, groundY - 41, 0x494554);
  tileBlock('title_house', [[165, 166, 167], [198, 199, 200]], shrineX - 16, groundY - 58, 0x9b6674);
  tileBlock('title_house', [[272]], shrineX, groundY - 16, 0x8f8393);
  tileBlock('title_house', [[105]], shrineX - 24, groundY - 15, 0xb68969);
  tileBlock('title_house', [[105]], shrineX + 27, groundY - 15, 0xb68969);
  items.push(scene.add.sprite(width - 52, groundY - 10, Tex.heroIdle, 4).setTint(0xb1a0a6));

  const glow = scene.add.graphics();
  glow.fillStyle(0xe19b4a, 0.05).fillCircle(shrineX + 8, groundY - 22, 30);
  glow.fillStyle(0xffbc68, 0.09).fillCircle(shrineX + 8, groundY - 22, 18);
  items.push(glow);
  const flame = scene.add.sprite(shrineX + 8, groundY - 23, Tex.fxParticleFire, 0).setTint(0xffcb80);
  if (!scene.anims.exists('title_fire')) {
    scene.anims.create({ key: 'title_fire', frames: scene.anims.generateFrameNumbers(Tex.fxParticleFire), frameRate: 8, repeat: -1 });
  }
  flame.play('title_fire');
  items.push(flame);
  items.push(scene.add.particles(shrineX + 8, groundY - 26, Tex.fxParticleSpark, {
    frame: 0, speedX: { min: -5, max: 8 }, speedY: { min: -15, max: -7 },
    lifespan: 2600, frequency: 370, maxParticles: 10,
    scale: 0.25, alpha: { start: 0.65, end: 0 }, tint: 0xffb867,
  }));
  return scene.add.container(0, 0, items);
}
