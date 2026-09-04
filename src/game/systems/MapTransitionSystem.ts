import Phaser from 'phaser';
import type { WorldScene } from '../scenes/WorldScene';
import { findObjects, propBool, propStr, type TiledObject } from '../world/MapLoader';
import { sfxKey } from '../config/assets';

/**
 * Door zones from the map's `Doors` object layer. Entering one fades out, records the destination on the
 * session and restarts WorldScene, which tears the old map down for us.
 */
export class MapTransitionSystem {
  private transitioning = false;
  private readonly zones: Phaser.GameObjects.Zone[] = [];
  /** Doors are ignored for a moment after spawning so a spawn placed inside a door zone does not bounce back. */
  private armed = false;

  constructor(private readonly scene: WorldScene) {
    for (const o of findObjects(scene.loaded, 'Doors', 'Door')) this.addDoor(o);
    scene.time.delayedCall(400, () => {
      this.armed = true;
    });
  }

  private addDoor(o: TiledObject): void {
    const zone = this.scene.add.zone(o.x + o.width / 2, o.y + o.height / 2, o.width, o.height);
    this.scene.physics.add.existing(zone, true);
    this.zones.push(zone);
    const destinationMap = propStr(o, 'destinationMap');
    const destinationSpawn = propStr(o, 'destinationSpawn');
    const locked = propBool(o, 'locked', false);
    const requiredItem = propStr(o, 'requiredItem', '');
    const lockedMessage = propStr(o, 'lockedMessage', 'It is locked.');
    this.scene.physics.add.overlap(this.scene.player.sprite, zone, () => {
      if (!this.armed || this.transitioning) return;
      if (locked && requiredItem && !this.scene.hasItem(requiredItem)) {
        this.scene.showHint(lockedMessage);
        this.pushBack();
        return;
      }
      this.go(destinationMap, destinationSpawn);
    });
  }

  /** Nudge the player out of the zone so a locked door does not spam its message. */
  private pushBack(): void {
    const p = this.scene.player;
    const v = p.facingVector;
    p.setPosition(p.x - v.x * 6, p.y - v.y * 6);
    p.body.velocity.set(0, 0);
    this.armed = false;
    this.scene.time.delayedCall(500, () => {
      this.armed = true;
    });
  }

  go(mapId: string, spawnId: string): void {
    if (this.transitioning) return;
    this.transitioning = true;
    const scene = this.scene;
    scene.player.controlLocked = true;
    scene.player.body.velocity.set(0, 0);
    scene.sound.play(sfxKey('door'), { volume: 0.4 });
    scene.session.pendingSpawn = { mapId, spawnId };
    scene.session.save.player.mapId = mapId;
    scene.session.save.player.spawnId = spawnId;
    scene.cameras.main.fadeOut(260, 0, 0, 0);
    scene.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      scene.scene.restart({ mapId, spawnId });
    });
  }

  destroy(): void {
    for (const z of this.zones) z.destroy();
    this.zones.length = 0;
  }
}
