import { describe, expect, it } from 'vitest';
import { KEY_PRESETS, actionFor, defaultSettings, rebind, sanitize } from '../../src/app/settings';

describe('actionFor', () => {
  it.each([
    ['q', 'rotXp'],
    ['A', 'rotXn'],
    ['w', 'rotYp'],
    ['d', 'rotZn'],
    ['ArrowLeft', 'left'],
    [' ', 'drop'],
    ['p', 'pause'],
    ['x', undefined],
  ])('maps %s to %s with QWERTY keys', (key, action) => {
    expect(actionFor(key, KEY_PRESETS.qwerty)).toBe(action);
  });

  it('follows the AZERTY preset', () => {
    expect(actionFor('z', KEY_PRESETS.azerty)).toBe('rotYp');
    expect(actionFor('q', KEY_PRESETS.azerty)).toBe('rotXn');
  });
});

describe('rebind', () => {
  it('swaps keys when the new key is already used', () => {
    const keys = rebind(KEY_PRESETS.qwerty, 'rotXp', 'w');
    expect(keys.rotXp).toBe('w');
    expect(keys.rotYp).toBe('q');
  });

  it('refuses reserved movement keys', () => {
    expect(rebind(KEY_PRESETS.qwerty, 'rotXp', 'p')).toEqual(KEY_PRESETS.qwerty);
  });
});

describe('sanitize', () => {
  it('clamps out-of-range values and ignores garbage', () => {
    const s = sanitize({ setup: { width: 99, depth: 1, blockSet: 'evil' }, lineWidth: -4, sound: 'yes' });
    expect(s.setup).toMatchObject({ width: 7, depth: 6, blockSet: 'flat' });
    expect(s.lineWidth).toBe(0);
    expect(s.sound).toBe(true);
  });

  it.each([null, 42, 'x'])('falls back to defaults for %s', (raw) => {
    expect(sanitize(raw)).toEqual(defaultSettings());
  });

  it('rejects duplicated key bindings', () => {
    expect(sanitize({ keys: { ...KEY_PRESETS.qwerty, rotYp: 'q' } }).keys).toEqual(KEY_PRESETS.qwerty);
  });
});
