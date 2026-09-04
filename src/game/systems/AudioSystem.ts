import Phaser from 'phaser';
import type { MusicId, SfxId } from '../data/audio';
import { musicKey, sfxKey } from '../config/assets';
import { SettingsStore } from './SettingsStore';

export interface AudioSettings {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  muted: boolean;
}

const FADE_OUT_MS = 420;
const FADE_IN_MS = 620;

/**
 * Music and sound effects.
 *
 * Area music cross-fades rather than cutting, because a hard stop-start at every doorway made the world feel
 * like separate screens. Boss music is the deliberate exception: it fades in fast so the encounter lands.
 */
export class AudioSystem {
  private currentMusic: Phaser.Sound.BaseSound | null = null;
  private currentId: MusicId | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly settings: AudioSettings = { masterVolume: 1, musicVolume: 0.75, sfxVolume: 0.85, muted: false },
  ) {}

  playMusic(id: MusicId, options: { fadeInMs?: number; fadeOutMs?: number } = {}): void {
    const key = musicKey(id);
    if (this.currentId === id && this.currentMusic?.isPlaying) return;
    if (!this.scene.cache.audio.exists(key)) return;

    const fadeOut = options.fadeOutMs ?? FADE_OUT_MS;
    const previous = this.currentMusic;
    if (previous?.isPlaying) this.fadeOutAndStop(previous, fadeOut);

    const target = this.volume(this.settings.musicVolume);
    const next = this.scene.sound.add(key, { loop: true, volume: 0 });
    this.currentMusic = next;
    this.currentId = id;
    const start = (): void => {
      if (this.currentMusic !== next) return;
      next.play();
      this.scene.tweens.addCounter({
        from: 0,
        to: 1,
        duration: options.fadeInMs ?? FADE_IN_MS,
        ease: 'Sine.easeOut',
        onUpdate: (tween) => {
          if (!next.isPlaying) return;
          (next as unknown as { volume: number }).volume = target * (tween.getValue() ?? 0);
        },
      });
    };
    // Browsers block audio until the first gesture; start on unlock rather than dropping the track.
    if (this.scene.sound.locked) this.scene.sound.once(Phaser.Sound.Events.UNLOCKED, start);
    else start();
  }

  stopMusic(fadeMs = FADE_OUT_MS): void {
    if (this.currentMusic) this.fadeOutAndStop(this.currentMusic, fadeMs);
    this.currentMusic = null;
    this.currentId = null;
  }

  /**
   * Fades a track out and disposes it. A counter tween is used rather than tweening the sound directly:
   * a scene restart can destroy the sound mid-fade, and writing `volume` on a destroyed sound throws.
   */
  private fadeOutAndStop(sound: Phaser.Sound.BaseSound, duration: number): void {
    const dispose = (): void => {
      if (!sound || (sound as { pendingRemove?: boolean }).pendingRemove) return;
      try {
        sound.stop();
        sound.destroy();
      } catch {
        // The sound manager already disposed it during a scene teardown.
      }
    };
    if (duration <= 0) {
      dispose();
      return;
    }
    const from = (sound as unknown as { volume: number }).volume ?? 1;
    this.scene.tweens.addCounter({
      from: 1,
      to: 0,
      duration,
      ease: 'Sine.easeIn',
      onUpdate: (tween) => {
        if (!sound || !sound.isPlaying) return;
        (sound as unknown as { volume: number }).volume = from * (tween.getValue() ?? 0);
      },
      onComplete: dispose,
      onStop: dispose,
    });
  }

  playSfx(id: SfxId, volume = 1, detune = 0): void {
    const level = this.volume(this.settings.sfxVolume) * volume;
    if (level <= 0) return;
    this.scene.sound.play(sfxKey(id), { volume: level, detune });
  }

  setMuted(muted: boolean): void {
    this.settings.muted = muted;
    this.scene.sound.mute = muted;
  }

  private volume(channelVolume: number): number {
    if (this.settings.muted) return 0;
    const master = SettingsStore.get().masterVolume;
    return Math.max(0, Math.min(1, master * this.settings.masterVolume * channelVolume));
  }
}
