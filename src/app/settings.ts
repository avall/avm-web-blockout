import type { Axis, Direction } from '../domain/geometry';
import type { BlockSet } from '../domain/pieces';

export type RotationAction = 'rotXp' | 'rotYp' | 'rotZp' | 'rotXn' | 'rotYn' | 'rotZn';
export type Action = RotationAction | 'left' | 'right' | 'up' | 'down' | 'drop' | 'pause';

export const ROTATIONS: Record<RotationAction, { axis: Axis; dir: Direction }> = {
  rotXp: { axis: 'x', dir: 1 },
  rotYp: { axis: 'y', dir: 1 },
  rotZp: { axis: 'z', dir: 1 },
  rotXn: { axis: 'x', dir: -1 },
  rotYn: { axis: 'y', dir: -1 },
  rotZn: { axis: 'z', dir: -1 },
};

export const KEY_PRESETS: Record<'qwerty' | 'azerty', Record<RotationAction, string>> = {
  qwerty: { rotXp: 'q', rotYp: 'w', rotZp: 'e', rotXn: 'a', rotYn: 's', rotZn: 'd' },
  azerty: { rotXp: 'a', rotYp: 'z', rotZp: 'e', rotXn: 'q', rotYn: 's', rotZn: 'd' },
};

// Movement, drop and pause are fixed, as in the original game.
const FIXED_KEYS: Record<string, Action> = {
  arrowleft: 'left',
  arrowright: 'right',
  arrowup: 'up',
  arrowdown: 'down',
  ' ': 'drop',
  p: 'pause',
};

export interface Setup {
  width: number;
  height: number;
  depth: number;
  blockSet: BlockSet;
  startLevel: number;
}

export interface Settings {
  setup: Setup;
  keys: Record<RotationAction, string>;
  sound: boolean;
  rotationSpeed: number;
  transparency: number;
  lineWidth: number;
}

export const PRESETS: { id: string; name: string; setup: Setup }[] = [
  { id: 'flat-fun', name: 'Flat Fun', setup: { width: 5, height: 5, depth: 12, blockSet: 'flat', startLevel: 0 } },
  { id: '3d-mania', name: '3D Mania', setup: { width: 3, height: 3, depth: 10, blockSet: 'basic', startLevel: 0 } },
  { id: 'out-of-control', name: 'Out of Control', setup: { width: 5, height: 5, depth: 10, blockSet: 'extended', startLevel: 0 } },
];

export const LIMITS = { side: [3, 7], depth: [6, 18], level: [0, 9], slider: [0, 10] } as const;

export const defaultSettings = (): Settings => ({
  setup: { ...PRESETS[0].setup },
  keys: { ...KEY_PRESETS.qwerty },
  sound: true,
  rotationSpeed: 5,
  transparency: 0,
  lineWidth: 2,
});

/** Resolves a KeyboardEvent.key to a game action with the current bindings. */
export function actionFor(key: string, keys: Record<RotationAction, string>): Action | undefined {
  const k = key.toLowerCase();
  const rotation = (Object.keys(keys) as RotationAction[]).find((a) => keys[a] === k);
  return rotation ?? FIXED_KEYS[k];
}

/** Binds a key to a rotation, swapping with the action that previously owned it. */
export function rebind(keys: Record<RotationAction, string>, action: RotationAction, key: string): Record<RotationAction, string> {
  const k = key.toLowerCase();
  if (k in FIXED_KEYS) return keys;
  const owner = (Object.keys(keys) as RotationAction[]).find((a) => keys[a] === k);
  const next = { ...keys, [action]: k };
  if (owner && owner !== action) next[owner] = keys[action];
  return next;
}

const clamp = (v: unknown, [lo, hi]: readonly [number, number], fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : fallback;

/** Merges untrusted stored data over defaults, clamping every value. */
export function sanitize(raw: unknown): Settings {
  const d = defaultSettings();
  if (!raw || typeof raw !== 'object') return d;
  const r = raw as Partial<Settings>;
  const s = (r.setup ?? {}) as Partial<Setup>;
  const keys = { ...d.keys };
  for (const a of Object.keys(keys) as RotationAction[]) {
    const v = r.keys?.[a];
    if (typeof v === 'string' && v.length === 1) keys[a] = v.toLowerCase();
  }
  return {
    setup: {
      width: clamp(s.width, LIMITS.side, d.setup.width),
      height: clamp(s.height, LIMITS.side, d.setup.height),
      depth: clamp(s.depth, LIMITS.depth, d.setup.depth),
      blockSet: (['flat', 'basic', 'extended'] as const).find((b) => b === s.blockSet) ?? d.setup.blockSet,
      startLevel: clamp(s.startLevel, LIMITS.level, d.setup.startLevel),
    },
    keys: new Set(Object.values(keys)).size === 6 ? keys : d.keys,
    sound: typeof r.sound === 'boolean' ? r.sound : d.sound,
    rotationSpeed: clamp(r.rotationSpeed, LIMITS.slider, d.rotationSpeed),
    transparency: clamp(r.transparency, LIMITS.slider, d.transparency),
    lineWidth: clamp(r.lineWidth, LIMITS.slider, d.lineWidth),
  };
}

const STORAGE_KEY = 'blockout3d.settings';

export function loadSettings(): Settings {
  try {
    return sanitize(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null'));
  } catch {
    return defaultSettings();
  }
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage may be unavailable (private mode); settings then live for the session only.
  }
}
