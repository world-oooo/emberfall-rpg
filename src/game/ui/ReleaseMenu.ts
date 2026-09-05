import Phaser from 'phaser';
import { Tex, sfxKey } from '../config/assets';
import { Depth } from '../config/constants';
import type { InputActions } from '../input/InputActions';
import { SaveSystem } from '../systems/SaveSystem';
import { SettingsStore, type Settings } from '../systems/SettingsStore';
import { inputBindingStore, formatKeyboardCode, BINDABLE_ACTIONS, ACTION_LABELS, type BindableAction } from '../input/InputBindingStore';
import { Display } from '../systems/DisplaySystem';
import { NinePanel, UiColor } from './widgets/NinePanel';
import { Plate } from './widgets/Plate';

export type ReleaseMenuKind = 'pause' | 'options' | 'controls' | 'save' | 'credits';

/** Row pitch in logical pixels: an 8 px glyph line with a 5 px gap reads cleanly at every zoom. */
const ROW_HEIGHT = 13;

interface MenuRow {
  label: string;
  value?: string;
  enabled?: boolean;
  action: () => void | Promise<void>;
  adjust?: (direction: number) => void | Promise<void>;
}

export interface ReleaseMenuCallbacks {
  onClose?: () => void;
  onResume?: () => void;
  onSaveChanged?: () => void;
  onSaveAndQuit?: () => Promise<boolean>;
  allowImport?: boolean;
  saveSystem?: SaveSystem;
}

type Mode = ReleaseMenuKind | 'confirm';

export class ReleaseMenu {
  private container: Phaser.GameObjects.Container | null = null;
  private mode: Mode | null = null;
  private parentMode: ReleaseMenuKind = 'pause';
  private index = 0;
  private scroll = 0;
  private readonly saveSystem: SaveSystem;
  private status = '';
  private listeningFor: BindableAction | null = null;
  private confirmAction: (() => void | Promise<void>) | null = null;
  private confirmCancel: (() => void) | null = null;
  private confirmTitle = '';
  private confirmBody = '';
  private busy = false;
  private rebindListener: ((event: KeyboardEvent) => void) | null = null;
  private readyAt = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly input: InputActions,
    private readonly callbacks: ReleaseMenuCallbacks = {},
  ) {
    this.saveSystem = callbacks.saveSystem ?? new SaveSystem();
  }

  get active(): boolean {
    return this.mode !== null;
  }

  /** Label of the currently highlighted row, for DEV/test navigation. Null when closed. */
  get selectionLabel(): string | null {
    if (!this.mode) return null;
    if (this.mode === 'credits') return 'Back';
    return this.rows()[this.index]?.label ?? null;
  }

  open(kind: ReleaseMenuKind): void {
    this.parentMode = kind;
    this.mode = kind;
    this.readyAt = this.scene.time.now + 160;
    this.index = 0;
    this.scroll = 0;
    this.status = '';
    this.listeningFor = null;
    this.render();
    this.scene.sound.play(sfxKey('menu_accept'), { volume: 0.25 });
  }

  confirm(title: string, body: string, onConfirm: () => void | Promise<void>, onCancel?: () => void): void {
    this.confirmTitle = title;
    this.confirmBody = body;
    this.confirmAction = onConfirm;
    this.confirmCancel = onCancel ?? null;
    this.mode = 'confirm';
    this.index = 0;
    this.render();
  }

  update(_time: number): void {
    if (!this.mode || this.busy || _time < this.readyAt) return;
    if (this.listeningFor) return;
    if (this.input.pressed('menuDown')) this.move(1);
    if (this.input.pressed('menuUp')) this.move(-1);
    if (this.input.pressed('menuLeft')) void this.adjust(-1);
    if (this.input.pressed('menuRight')) void this.adjust(1);
    if (this.input.pressed('confirm')) void this.activate();
    if (this.input.pressed('cancel') || this.input.pressed('pause')) this.cancel();
  }

  resize(): void {
    if (this.mode) this.render();
  }

  destroy(): void {
    if (this.rebindListener) this.scene.input.keyboard?.off(Phaser.Input.Keyboard.Events.ANY_KEY_DOWN, this.rebindListener);
    this.rebindListener = null;
    this.container?.destroy(true);
    this.container = null;
    this.mode = null;
    this.listeningFor = null;
  }

  private rows(): MenuRow[] {
    const settings = SettingsStore.get();
    if (this.mode === 'pause') {
      return [
        { label: 'Resume', action: () => this.resume() },
        { label: 'Options', action: () => this.switchTo('options') },
        { label: 'Controls', action: () => this.switchTo('controls') },
        { label: 'Save Data', action: () => this.switchTo('save') },
        { label: 'Save & Quit', action: () => void this.saveAndQuit() },
      ];
    }
    if (this.mode === 'options') return this.optionRows(settings);
    if (this.mode === 'controls') return this.controlRows();
    if (this.mode === 'save') return this.saveRows();
    if (this.mode === 'credits') return [{ label: 'Back', action: () => this.cancel() }];
    return [
      { label: 'Cancel', action: () => this.cancelConfirm() },
      { label: 'Confirm', action: () => void this.acceptConfirm() },
    ];
  }

  private optionRows(settings: Settings): MenuRow[] {
    return [
      {
        label: 'Master',
        value: `${Math.round(settings.masterVolume * 100)}%`,
        action: () => this.adjustOption('masterVolume', 1),
        adjust: (direction) => this.adjustOption('masterVolume', direction),
      },
      {
        label: 'Music',
        value: `${Math.round(settings.musicVolume * 100)}%`,
        action: () => this.adjustOption('musicVolume', 1),
        adjust: (direction) => this.adjustOption('musicVolume', direction),
      },
      {
        label: 'SFX',
        value: `${Math.round(settings.sfxVolume * 100)}%`,
        action: () => this.adjustOption('sfxVolume', 1),
        adjust: (direction) => this.adjustOption('sfxVolume', direction),
      },
      { label: 'Shake', value: settings.screenShake ? 'ON' : 'OFF', action: () => this.toggle('screenShake') },
      { label: 'Display', value: settings.displayMode === 'fill' ? 'FILL' : 'FIXED', action: () => this.toggleDisplay() },
      { label: 'Hints', value: settings.showHints ? 'ON' : 'OFF', action: () => this.toggle('showHints') },
      { label: 'Fullscreen', value: this.isFullscreen() ? 'ON' : 'OFF', action: () => void this.toggleFullscreen() },
      { label: 'Reset Options', action: () => this.confirm('RESET OPTIONS', 'Restore audio, display, hints, and shake defaults?', () => this.resetOptions()) },
      { label: 'Save Data', action: () => this.switchTo('save') },
      { label: 'Back', action: () => this.cancel() },
    ];
  }

  private controlRows(): MenuRow[] {
    return [
      ...BINDABLE_ACTIONS.map((action) => ({
        label: ACTION_LABELS[action],
        // Same labels the prompts use, deduplicated: raw codes such as ShiftLeft/ShiftRight wrapped the row.
        value: Array.from(new Set(inputBindingStore.getBinding(action).map(formatKeyboardCode))).join(', '),
        action: () => this.beginRebind(action),
      })),
      {
        label: 'Reset Controls',
        action: () => this.confirm('RESET CONTROLS', 'Restore the default keyboard bindings?', () => {
          inputBindingStore.reset();
          this.status = 'Controls restored.';
          this.switchTo('controls');
        }),
      },
      { label: 'Back', action: () => this.cancel() },
    ];
  }

  private saveRows(): MenuRow[] {
    const rows: MenuRow[] = [
      { label: 'Export Save', action: () => void this.exportSave() },
      { label: 'Import Save', enabled: Boolean(this.callbacks.allowImport), action: () => void this.importSave() },
      { label: 'Credits', action: () => this.switchTo('credits') },
      { label: 'Back', action: () => this.cancel() },
    ];
    return rows;
  }

  private move(direction: number): void {
    const rows = this.rows();
    if (!rows.length) return;
    let next = this.index;
    for (let attempt = 0; attempt < rows.length; attempt += 1) {
      next = (next + direction + rows.length) % rows.length;
      if (rows[next]?.enabled !== false) break;
    }
    this.index = next;
    this.keepSelectedVisible(rows.length);
    this.scene.sound.play(sfxKey('menu_move'), { volume: 0.25 });
    this.render();
  }

  private async adjust(direction: number): Promise<void> {
    const row = this.rows()[this.index];
    if (!row?.adjust) return;
    await row.adjust(direction);
    this.scene.sound.play(sfxKey('menu_accept'), { volume: 0.2 });
    this.render();
  }

  private async activate(): Promise<void> {
    const row = this.rows()[this.index];
    if (!row || row.enabled === false) return;
    await row.action();
    this.render();
  }

  private cancel(): void {
    if (this.mode === 'confirm') {
      this.cancelConfirm();
      return;
    }
    if (this.mode === 'pause') {
      this.resume();
      return;
    }
    if (this.mode === this.parentMode) this.resume();
    else this.switchTo(this.parentMode);
  }

  private switchTo(kind: ReleaseMenuKind): void {
    this.mode = kind;
    this.readyAt = this.scene.time.now + 160;
    this.index = 0;
    this.scroll = 0;
    this.listeningFor = null;
    this.render();
  }

  private resume(): void {
    this.destroy();
    this.callbacks.onResume?.();
    this.callbacks.onClose?.();
    this.scene.sound.play(sfxKey('menu_cancel'), { volume: 0.25 });
  }

  private adjustOption(key: 'masterVolume' | 'musicVolume' | 'sfxVolume', direction: number): void {
    const current = SettingsStore.get();
    const value = Math.max(0, Math.min(1, Math.round((current[key] + direction * 0.1) * 10) / 10));
    SettingsStore.set({ [key]: value });
    if (key === 'masterVolume') this.scene.sound.volume = value;
  }

  private toggle(key: 'screenShake' | 'showHints'): void {
    SettingsStore.set({ [key]: !SettingsStore.get()[key] });
  }

  private toggleDisplay(): void {
    Display.toggleMode();
  }

  private async toggleFullscreen(): Promise<void> {
    try {
      if (this.isFullscreen()) await document.exitFullscreen();
      else await this.scene.game.canvas.requestFullscreen();
      SettingsStore.set({ fullscreen: this.isFullscreen() });
      this.status = '';
    } catch {
      SettingsStore.set({ fullscreen: false });
      this.status = 'Fullscreen blocked by the browser.';
    }
    this.render();
  }

  private resetOptions(): void {
    SettingsStore.reset();
    this.scene.sound.volume = SettingsStore.get().masterVolume;
    Display.refresh();
    this.status = 'Options restored.';
    this.switchTo('options');
  }

  private beginRebind(action: BindableAction): void {
    this.listeningFor = action;
    this.status = `Press a key for ${ACTION_LABELS[action]}.`;
    this.render();
    const keyboard = this.scene.input.keyboard;
    if (!keyboard) return;
    this.rebindListener = (event: KeyboardEvent) => {
      if (event.code === 'Escape') {
        this.status = 'Binding cancelled.';
      } else {
        const result = inputBindingStore.bind(action, event.code);
        this.status = result.ok ? `${ACTION_LABELS[action]} updated.` : result.reason === 'conflict' ? `Used by ${ACTION_LABELS[result.conflictAction!]}.` : 'That key is unavailable.';
      }
      this.input.clearBuffer();
      this.listeningFor = null;
      this.rebindListener = null;
      this.readyAt = this.scene.time.now + 200;
      this.render();
    };
    keyboard.once(Phaser.Input.Keyboard.Events.ANY_KEY_DOWN, this.rebindListener);
  }

  private async exportSave(): Promise<void> {
    this.busy = true;
    try {
      const json = await this.saveSystem.export();
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'emberfall-save.json';
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      this.status = 'Save exported.';
    } catch (error) {
      this.status = error instanceof Error ? error.message : 'Export failed.';
    } finally {
      this.busy = false;
      this.render();
    }
  }

  private async importSave(): Promise<void> {
    if (!this.callbacks.allowImport) return;
    const picker = document.createElement('input');
    picker.type = 'file';
    picker.accept = '.json,application/json';
    picker.addEventListener('change', () => {
      const file = picker.files?.[0];
      if (!file) return;
      void (async () => {
        try {
          if (file.size > 1_000_000) throw new Error('Save file is too large.');
          const parsed = SaveSystem.parseImport(await file.text());
          this.confirm('IMPORT SAVE', `Replace progress with level ${parsed.player.level} in ${parsed.player.mapId}?`, async () => {
            this.busy = true;
            try {
              await this.saveSystem.save(parsed);
              this.callbacks.onSaveChanged?.();
              this.status = 'Save imported.';
            } catch {
              this.status = 'Import failed. Existing save retained.';
            } finally {
              this.busy = false;
              this.switchTo('save');
            }
          });
        } catch (error) {
          this.status = error instanceof Error ? error.message : 'Save data is invalid.';
          this.render();
        }
      })();
    }, { once: true });
    picker.click();
  }

  private async saveAndQuit(): Promise<void> {
    this.busy = true;
    this.status = 'Saving...';
    this.render();
    const ok = await (this.callbacks.onSaveAndQuit?.() ?? Promise.resolve(false));
    this.busy = false;
    if (!ok) {
      this.status = 'Save failed. Try again.';
      this.render();
    }
  }

  private cancelConfirm(): void {
    const fallback = this.parentMode;
    const onCancel = this.confirmCancel;
    this.confirmAction = null;
    this.confirmCancel = null;
    if (onCancel) { onCancel(); return; }
    this.mode = fallback;
    this.index = 0;
    this.render();
  }

  private async acceptConfirm(): Promise<void> {
    const action = this.confirmAction;
    this.confirmAction = null;
    this.confirmCancel = null;
    if (action) await action();
  }

  private render(): void {
    this.container?.destroy(true);
    if (!this.mode) return;
    const w = Display.width;
    const h = Display.height;
    const width = Math.min(w - 24, w <= 330 ? 292 : 336);
    const height = this.panelHeight();
    const x = Math.round((w - width) / 2);
    const y = Math.round((h - height) / 2);
    const shade = this.scene.add.rectangle(0, 0, w, h, 0x07060b, 0.68).setOrigin(0, 0);
    const frame = new NinePanel(this.scene, x, y, width, height, Tex.panelWood);
    const inner = new Plate(this.scene, width - 14, height - 30, { radius: 2, fill: 0x191621, alpha: 0.96 });
    inner.setPosition(x + 7, y + 23);
    const header = this.scene.add.rectangle(x + 7, y + 5, width - 14, 15, 0x191621).setOrigin(0, 0);
    const title = this.scene.add.bitmapText(x + 12, y + 8, Tex.font, this.title(), 8).setTint(UiColor.emberBright);
    title.setLetterSpacing(2);
    const hint = this.scene.add.bitmapText(x + width - 12, y + 8, Tex.font, this.hint(), 8).setOrigin(1, 0).setTint(UiColor.textFaint);
    const items: Phaser.GameObjects.GameObject[] = [shade, frame, inner, header, title, hint];

    if (this.mode === 'credits') this.renderCredits(items, x, y, width, height);
    else if (this.mode === 'confirm') this.renderConfirm(items, x, y, width);
    else this.renderRows(items, x, y, width, height);

    if (this.status) {
      items.push(
        this.scene.add
          .bitmapText(x + 12, y + height - 18, Tex.font, this.status, 8)
          .setTint(this.status.includes('invalid') || this.status.includes('failed') || this.status.includes('blocked') ? UiColor.danger : UiColor.good)
          .setMaxWidth(width - 24),
      );
    }
    this.container = this.scene.add.container(0, 0, items).setDepth(Depth.UI + 40);
  }

  private renderRows(items: Phaser.GameObjects.GameObject[], x: number, y: number, width: number, height: number): void {
    const rows = this.rows();
    const visibleRows = this.visibleRowCount(rows.length, height);
    this.keepSelectedVisible(rows.length, visibleRows);
    const top = y + 32;
    rows.slice(this.scroll, this.scroll + visibleRows).forEach((row, offset) => {
      const index = this.scroll + offset;
      const selected = index === this.index;
      const rowY = top + offset * ROW_HEIGHT;
      const enabled = row.enabled !== false;
      if (selected) items.push(this.scene.add.rectangle(x + 11, rowY - 3, width - 22, ROW_HEIGHT - 1, 0x2f2a3a).setOrigin(0, 0));
      if (selected) items.push(this.scene.add.image(x + 14, rowY + 3, Tex.arrowRight).setOrigin(0.5));
      items.push(this.scene.add.bitmapText(x + 24, rowY, Tex.font, row.label, 8).setTint(!enabled ? UiColor.textFaint : selected ? UiColor.emberBright : UiColor.text));
      if (row.value) {
        // A selected row that can be adjusted shows the value between two arrows: that is how a player learns
        // that left and right change it, without a hint competing for header space.
        const flank = selected && enabled && !!row.adjust;
        const valueRight = x + width - (flank ? 24 : 16);
        const value = this.scene.add
          .bitmapText(valueRight, rowY, Tex.font, row.value, 8)
          .setOrigin(1, 0)
          .setTint(!enabled ? UiColor.textFaint : selected ? UiColor.emberBright : UiColor.textDim)
          .setMaxWidth(Math.floor(width * 0.45));
        items.push(value);
        if (flank) {
          items.push(this.scene.add.image(valueRight - value.width - 6, rowY + 4, Tex.arrowLeft).setOrigin(0.5).setTint(UiColor.emberBright));
          items.push(this.scene.add.image(x + width - 14, rowY + 4, Tex.arrowRight).setOrigin(0.5).setTint(UiColor.emberBright));
        }
      }
    });
    if (this.listeningFor) {
      items.push(this.scene.add.rectangle(x + 7, y + 23, width - 14, height - 30, 0x07060b, 0.76).setOrigin(0, 0));
      items.push(
        this.scene.add
          .bitmapText(x + width / 2, y + height / 2 - 8, Tex.font, `PRESS KEY\n${ACTION_LABELS[this.listeningFor]}`, 8)
          .setOrigin(0.5, 0)
          .setCenterAlign()
          .setTint(UiColor.emberBright),
      );
    }
    if (rows.length > visibleRows) {
      const page = `${this.scroll + 1}-${Math.min(rows.length, this.scroll + visibleRows)}/${rows.length}`;
      items.push(this.scene.add.bitmapText(x + width - 14, y + height - 18, Tex.font, page, 8).setOrigin(1, 0).setTint(UiColor.textFaint));
    }
  }

  private renderConfirm(items: Phaser.GameObjects.GameObject[], x: number, y: number, width: number): void {
    items.push(
      this.scene.add
        .bitmapText(x + width / 2, y + 42, Tex.font, this.confirmTitle, 8)
        .setOrigin(0.5, 0)
        .setTint(UiColor.emberBright)
        .setCenterAlign()
        .setMaxWidth(width - 36),
    );
    items.push(
      this.scene.add
        .bitmapText(x + width / 2, y + 62, Tex.font, this.confirmBody, 8)
        .setOrigin(0.5, 0)
        .setTint(UiColor.text)
        .setCenterAlign()
        .setMaxWidth(width - 38),
    );
    this.renderRows(items, x, y + 76, width, 58);
  }

  private renderCredits(items: Phaser.GameObjects.GameObject[], x: number, y: number, width: number, height: number): void {
    const copy = [
      'EMBERFALL',
      'Created by world-oooo',
      'Art, UI, audio: Ninja Adventure',
      'Pixel-Boy and AAA',
      'License: CC0 1.0',
      'Tooling: Phaser, Vite, TypeScript',
      '',
      'Back',
    ];
    const top = y + 34;
    copy.forEach((line, i) => {
      const selected = i === copy.length - 1 && this.index === 0;
      const tint = i === 0 ? UiColor.emberBright : selected ? UiColor.emberBright : UiColor.text;
      items.push(this.scene.add.bitmapText(x + width / 2, top + i * 11, Tex.font, selected ? `> ${line}` : line, 8).setOrigin(0.5, 0).setTint(tint).setCenterAlign());
    });
    items.push(this.scene.add.bitmapText(x + width / 2, y + height - 18, Tex.font, 'docs/ASSET_LICENSES.md', 8).setOrigin(0.5, 0).setTint(UiColor.textFaint));
  }

  /** Nearly the full screen height: the menu is a modal and the Options page has ten rows to show. */
  private panelHeight(): number {
    return Math.min(Display.height - 8, 200);
  }

  /**
   * How many rows fit. When every row fits there is no page indicator, so the rows may run to the bottom
   * margin; otherwise the last slot is kept clear for it. At 720p, 768p and 1080p all ten Options rows fit.
   */
  private visibleRowCount(rowCount: number, height = this.panelHeight()): number {
    const fitAll = Math.floor((height - 42) / ROW_HEIGHT);
    if (rowCount <= fitAll) return Math.max(1, rowCount);
    return Math.max(5, Math.floor((height - 52) / ROW_HEIGHT));
  }

  private keepSelectedVisible(rowCount: number, visibleRows = this.visibleRowCount(rowCount)): void {
    if (this.index < this.scroll) this.scroll = this.index;
    if (this.index >= this.scroll + visibleRows) this.scroll = this.index - visibleRows + 1;
    this.scroll = Math.max(0, Math.min(this.scroll, Math.max(0, rowCount - visibleRows)));
  }

  private title(): string {
    if (this.mode === 'confirm') return 'CONFIRM';
    if (this.mode === 'pause') return 'PAUSED';
    if (this.mode === 'options') return 'OPTIONS';
    if (this.mode === 'controls') return 'CONTROLS';
    if (this.mode === 'save') return 'SAVE DATA';
    return 'CREDITS';
  }

  private hint(): string {
    if (this.mode === 'credits') return `${SettingsStore.keyLabel('interact')} BACK`;
    if (this.mode === 'confirm') return `${SettingsStore.keyLabel('interact')} SELECT`;
    // The real pause label, so the hint stays true if Pause is rebound and matches the inventory/quest headers.
    return `${SettingsStore.keyLabel('interact')} SELECT  ${inputBindingStore.getActiveDevice() === 'gamepad' ? 'B' : SettingsStore.keyLabel('pause')} BACK`;
  }

  private isFullscreen(): boolean {
    return document.fullscreenElement === this.scene.game.canvas;
  }
}

