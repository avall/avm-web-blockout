import type { BlockSet } from '../domain/pieces';
import type { RotationAction, Settings, Setup } from '../app/settings';
import { KEY_PRESETS, LIMITS, PRESETS, rebind } from '../app/settings';

const KEY_LAYOUT: { action: RotationAction; label: string }[] = [
  { action: 'rotXp', label: 'X +' },
  { action: 'rotYp', label: 'Y +' },
  { action: 'rotZp', label: 'Z +' },
  { action: 'rotXn', label: 'X −' },
  { action: 'rotYn', label: 'Y −' },
  { action: 'rotZn', label: 'Z −' },
];
const STEP_LIMITS: Record<'width' | 'height' | 'depth' | 'startLevel', readonly [number, number]> = {
  width: LIMITS.side,
  height: LIMITS.side,
  depth: LIMITS.depth,
  startLevel: LIMITS.level,
};
const SET_NAMES: Record<BlockSet, string> = { flat: 'Flat', basic: 'Basic', extended: 'Extended' };

type OptionKey = 'rotationSpeed' | 'transparency' | 'lineWidth';

/** Setup, key binding and option panels. Emits every change through onChange. */
export class Panels {
  /** Rotation currently waiting for a key press, if any. */
  listening: RotationAction | null = null;

  constructor(
    private settings: Settings,
    private readonly onChange: (s: Settings) => void,
  ) {
    this.buildPresets();
    this.buildKeys();
    this.wire();
    this.render();
  }

  private update(next: Partial<Settings>): void {
    this.settings = { ...this.settings, ...next };
    this.render();
    this.onChange(this.settings);
  }

  private updateSetup(setup: Partial<Setup>): void {
    this.update({ setup: { ...this.settings.setup, ...setup } });
  }

  private buildPresets(): void {
    document.querySelector('.presets')!.replaceChildren(
      ...PRESETS.map((p) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'seg-btn';
        b.dataset.preset = p.id;
        b.innerHTML = `${p.name}<small>Pit ${p.setup.width}x${p.setup.height}x${p.setup.depth} · ${SET_NAMES[p.setup.blockSet]}</small>`;
        b.addEventListener('click', () => this.updateSetup({ ...p.setup, startLevel: this.settings.setup.startLevel }));
        return b;
      }),
    );
  }

  private buildKeys(): void {
    document.querySelector('.key-grid')!.replaceChildren(
      ...KEY_LAYOUT.map(({ action, label }) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'key-btn';
        b.dataset.key = action;
        b.innerHTML = `<kbd></kbd><small>${label}</small>`;
        b.addEventListener('click', () => {
          this.listening = this.listening === action ? null : action;
          this.render();
        });
        return b;
      }),
    );
  }

  /** Handles a key while rebinding; returns true when the key was consumed. */
  captureKey(key: string): boolean {
    if (!this.listening) return false;
    if (key !== 'Escape' && key.length === 1) this.update({ keys: rebind(this.settings.keys, this.listening, key) });
    this.listening = null;
    this.render();
    return true;
  }

  private wire(): void {
    document.querySelectorAll<HTMLElement>('.stepper').forEach((el) => {
      const field = el.dataset.field as keyof typeof STEP_LIMITS;
      el.querySelectorAll<HTMLButtonElement>('button').forEach((btn) =>
        btn.addEventListener('click', () => {
          const [lo, hi] = STEP_LIMITS[field];
          const value = this.settings.setup[field] + Number(btn.dataset.step);
          this.updateSetup({ [field]: Math.min(hi, Math.max(lo, value)) });
        }),
      );
    });
    document.querySelectorAll<HTMLButtonElement>('[data-set]').forEach((b) =>
      b.addEventListener('click', () => this.updateSetup({ blockSet: b.dataset.set as BlockSet })),
    );
    document.querySelectorAll<HTMLButtonElement>('[data-preset-keys]').forEach((b) =>
      b.addEventListener('click', () => this.update({ keys: { ...KEY_PRESETS[b.dataset.presetKeys as 'qwerty' | 'azerty'] } })),
    );
    document.querySelector('[data-option="sound"]')!.addEventListener('click', () => this.update({ sound: !this.settings.sound }));
    document.querySelectorAll<HTMLInputElement>('input[data-option]').forEach((input) =>
      input.addEventListener('input', () => this.update({ [input.dataset.option as OptionKey]: Number(input.value) })),
    );
  }

  private render(): void {
    const { setup, keys } = this.settings;
    document.querySelectorAll<HTMLElement>('.stepper').forEach((el) => {
      el.querySelector('output')!.textContent = String(setup[el.dataset.field as keyof typeof STEP_LIMITS]);
    });
    document.querySelectorAll<HTMLButtonElement>('[data-preset]').forEach((b) => {
      const p = PRESETS.find((x) => x.id === b.dataset.preset)!.setup;
      const same = p.width === setup.width && p.height === setup.height && p.depth === setup.depth && p.blockSet === setup.blockSet;
      b.setAttribute('aria-pressed', String(same));
    });
    document.querySelectorAll<HTMLButtonElement>('[data-set]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.set === setup.blockSet)));
    document.querySelectorAll<HTMLButtonElement>('[data-preset-keys]').forEach((b) => {
      const preset = KEY_PRESETS[b.dataset.presetKeys as 'qwerty' | 'azerty'];
      b.setAttribute('aria-pressed', String(KEY_LAYOUT.every(({ action }) => preset[action] === keys[action])));
    });
    document.querySelectorAll<HTMLButtonElement>('.key-btn').forEach((b) => {
      const action = b.dataset.key as RotationAction;
      b.querySelector('kbd')!.textContent = this.listening === action ? '?' : keys[action].toUpperCase();
      b.dataset.listening = String(this.listening === action);
    });
    const sound = document.querySelector('[data-option="sound"]')!;
    sound.setAttribute('aria-checked', String(this.settings.sound));
    document.querySelectorAll<HTMLInputElement>('input[data-option]').forEach((input) => {
      const value = this.settings[input.dataset.option as OptionKey];
      input.value = String(value);
      input.parentElement!.querySelector('output')!.textContent = String(value);
    });
    document.querySelector('[data-testid="setup-summary"]')!.textContent =
      `Pit ${setup.width} × ${setup.height} × ${setup.depth} · ${SET_NAMES[setup.blockSet]} blocks · starting level ${setup.startLevel}. Changes apply to the next game.`;
  }
}
