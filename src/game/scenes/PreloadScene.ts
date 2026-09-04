import Phaser from 'phaser';
import { ASSET_ROOT, Tex, itemTexture, sfxKey } from '../config/assets';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/constants';
import { registerHeroAnimations } from '../entities/player/heroAnimations';
import { ITEMS } from '../data/items';
import { SFX_IDS } from '../data/audio';
import { NinePanel } from '../ui/widgets/NinePanel';

/** Core bundle: player, UI, common SFX, item icons. Map-specific bundles load in WorldScene. */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('PreloadScene');
  }

  preload(): void {
    this.buildLoadingScreen();
    this.load.setPath(ASSET_ROOT);

    // hero (32x32 frames; columns = down/up/left/right, rows = animation frames)
    const f32 = { frameWidth: 32, frameHeight: 32 };
    this.load.spritesheet(Tex.heroIdle, 'characters/hero/idle.png', f32);
    this.load.spritesheet(Tex.heroWalk, 'characters/hero/walk.png', f32);
    this.load.spritesheet(Tex.heroAttack, 'characters/hero/attack.png', f32);
    this.load.spritesheet(Tex.heroRoll, 'characters/hero/roll.png', f32);
    this.load.spritesheet(Tex.heroHit, 'characters/hero/hit.png', f32);
    this.load.spritesheet(Tex.heroDead, 'characters/hero/dead.png', f32);
    this.load.spritesheet(Tex.heroItem, 'characters/hero/item.png', f32);
    this.load.spritesheet(Tex.weaponKatana, 'characters/hero/weapon_katana.png', { frameWidth: 64, frameHeight: 64 });
    this.load.image(Tex.heroFace, 'characters/hero/faceset.png');
    this.load.image(Tex.shadow, 'characters/shadow.png');

    // ui
    this.load.image(Tex.panelInterior, 'ui/panel_interior.png');
    this.load.image(Tex.panelWood, 'ui/panel_2.png');
    this.load.image(Tex.arrowRight, 'ui/arrow_right.png');
    this.load.image(Tex.arrowLeft, 'ui/arrow_left.png');
    this.load.image(Tex.panelBg, 'ui/panel_bg.png');
    this.load.image(Tex.focus, 'ui/focus.png');
    this.load.spritesheet(Tex.hearts, 'ui/hearts.png', { frameWidth: 16, frameHeight: 16 });
    this.load.image(Tex.dialogBox, 'ui/dialog_box.png');
    this.load.image(Tex.facesetBox, 'ui/dialog_faceset_box.png');
    this.load.image(Tex.choiceBox, 'ui/choice_box.png');
    this.load.image(Tex.inventoryCell, 'ui/inventory_cell.png');
    this.load.image(Tex.arrow, 'ui/arrow.png');
    this.load.image(Tex.keyE, 'ui/key_e.png');
    this.load.image(Tex.emoteExclaim, 'ui/emote_exclaim.png');
    this.load.image(Tex.emoteQuestion, 'ui/emote_question.png');
    this.load.image(Tex.lifebarUnder, 'ui/lifebar_under.png');
    this.load.image(Tex.lifebarProgress, 'ui/lifebar_progress.png');

    // vfx (strips; frame sizes from the pack)
    this.load.spritesheet(Tex.fxSlashArc, 'vfx/slash_arc.png', { frameWidth: 38, frameHeight: 34 });
    this.load.spritesheet(Tex.fxSlash01, 'vfx/slash_01.png', { frameWidth: 26, frameHeight: 32 });
    this.load.spritesheet(Tex.fxSlash03, 'vfx/slash_03.png', { frameWidth: 38, frameHeight: 42 });
    this.load.spritesheet(Tex.fxSpark, 'vfx/spark.png', { frameWidth: 27, frameHeight: 35 });
    this.load.spritesheet(Tex.fxCircleSpark, 'vfx/circle_spark.png', { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet(Tex.fxSmoke, 'vfx/smoke.png', { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet(Tex.fxSmokeCircular, 'vfx/smoke_circular.png', { frameWidth: 24, frameHeight: 14 });
    this.load.spritesheet(Tex.fxExplosion, 'vfx/explosion.png', { frameWidth: 40, frameHeight: 40 });
    this.load.spritesheet(Tex.fxAura, 'vfx/aura.png', { frameWidth: 25, frameHeight: 24 });
    this.load.spritesheet(Tex.fxBoost, 'vfx/boost.png', { frameWidth: 53, frameHeight: 35 });
    this.load.spritesheet(Tex.fxSpirit, 'vfx/spirit.png', { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet(Tex.fxProjShuriken, 'vfx/proj_shuriken.png', { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet(Tex.fxProjPlant, 'vfx/proj_plant.png', { frameWidth: 16, frameHeight: 20 });
    this.load.spritesheet(Tex.fxProjEnergy, 'vfx/proj_energy.png', { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet(Tex.fxParticleLeaf, 'vfx/particle_leaf.png', { frameWidth: 8, frameHeight: 7 });
    this.load.spritesheet(Tex.fxParticleSpark, 'vfx/particle_spark.png', { frameWidth: 10, frameHeight: 8 });
    this.load.spritesheet(Tex.fxParticleRock, 'vfx/particle_rock.png', { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet(Tex.fxParticleGrass, 'vfx/particle_grass.png', { frameWidth: 8, frameHeight: 13 });
    this.load.spritesheet(Tex.fxParticleFire, 'vfx/particle_fire.png', { frameWidth: 8, frameHeight: 12 });
    this.load.spritesheet(Tex.fxParticleWood, 'vfx/particle_wood.png', { frameWidth: 8, frameHeight: 16 });

    // items
    for (const item of Object.values(ITEMS)) {
      this.load.image(itemTexture(item.id), `items/${item.icon}.png`);
    }
    this.load.spritesheet(Tex.chestSmall, 'items/chest_small.png', { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet(Tex.chestBig, 'items/chest_big.png', { frameWidth: 16, frameHeight: 14 });
    this.load.spritesheet(Tex.coinAnim, 'items/coin_anim.png', { frameWidth: 10, frameHeight: 10 });

    // common sfx
    for (const id of SFX_IDS) {
      this.load.audio(sfxKey(id), [`audio/sfx/${id}.ogg`, `audio/sfx/${id}.mp3`]);
    }
  }

  create(): void {
    registerHeroAnimations(this);
    this.registerCommonAnimations();
    this.scene.start('MainMenuScene');
  }

  private registerCommonAnimations(): void {
    const mk = (key: string, tex: string, frames: number, frameRate: number, repeat = 0) => {
      if (this.anims.exists(key)) return;
      this.anims.create({ key, frames: this.anims.generateFrameNumbers(tex, { start: 0, end: frames - 1 }), frameRate, repeat, hideOnComplete: repeat === 0 });
    };
    mk('fx_slash_arc', Tex.fxSlashArc, 6, 24);
    mk('fx_slash_01', Tex.fxSlash01, 5, 24);
    mk('fx_slash_03', Tex.fxSlash03, 6, 24);
    mk('fx_spark', Tex.fxSpark, 10, 30);
    mk('fx_circle_spark', Tex.fxCircleSpark, 6, 24);
    mk('fx_smoke', Tex.fxSmoke, 6, 18);
    mk('fx_smoke_circular', Tex.fxSmokeCircular, 10, 24);
    mk('fx_explosion', Tex.fxExplosion, 9, 20);
    mk('fx_aura', Tex.fxAura, 5, 12, -1);
    mk('fx_boost', Tex.fxBoost, 8, 16);
    mk('fx_spirit', Tex.fxSpirit, 5, 12, -1);
    mk('coin_spin', Tex.coinAnim, 4, 10, -1);
    mk('proj_shuriken', Tex.fxProjShuriken, 2, 20, -1);
    mk('proj_plant', Tex.fxProjPlant, 6, 12, -1);
    mk('proj_energy', Tex.fxProjEnergy, 4, 12, -1);
  }

  private buildLoadingScreen(): void {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    this.add.rectangle(cx, cy, GAME_WIDTH, GAME_HEIGHT, 0x0b0a12);
    const title = this.add.bitmapText(cx, cy - 34, Tex.font, 'EMBERFALL', 16).setOrigin(0.5).setTint(0xf0b45a);
    title.setLetterSpacing(2);
    const panel = new NinePanel(this, cx - 90, cy - 6, 180, 14, Tex.panelDark);
    const bar = this.add.rectangle(cx - 86, cy + 1, 0, 6, 0xf0b45a).setOrigin(0, 0.5);
    const label = this.add.bitmapText(cx, cy + 18, Tex.font, 'loading', 8).setOrigin(0.5).setTint(0xd9d2c5);
    this.load.on(Phaser.Loader.Events.PROGRESS, (v: number) => {
      bar.width = Math.round(172 * v);
      label.setText(`loading ${Math.round(v * 100)}%`);
    });
    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      panel.destroy();
      bar.destroy();
      label.destroy();
    });
  }
}
