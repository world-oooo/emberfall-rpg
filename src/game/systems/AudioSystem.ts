import type Phaser from 'phaser';
import type { MusicId, SfxId } from '../data/audio';
import { musicKey, sfxKey } from '../config/assets';

export interface AudioSettings {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  muted: boolean;
}

export class AudioSystem {
  private currentMusic: Phaser.Sound.BaseSound | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly settings: AudioSettings = { masterVolume: 1, musicVolume: 0.75, sfxVolume: 0.85, muted: false },
  ) {}

  playMusic(id: MusicId): void {
    const key = musicKey(id);
    if (this.currentMusic?.key === key && this.currentMusic.isPlaying) return;
    this.currentMusic?.stop();
    this.currentMusic = this.scene.sound.add(key, { loop: true, volume: this.volume(this.settings.musicVolume) });
    this.currentMusic.play();
  }

  stopMusic(): void {
    this.currentMusic?.stop();
    this.currentMusic = null;
  }

  playSfx(id: SfxId): void {
    this.scene.sound.play(sfxKey(id), { volume: this.volume(this.settings.sfxVolume) });
  }

  setMuted(muted: boolean): void {
    this.settings.muted = muted;
    this.scene.sound.mute = muted;
  }

  private volume(channelVolume: number): number {
    if (this.settings.muted) return 0;
    return Math.max(0, Math.min(1, this.settings.masterVolume * channelVolume));
  }
}
