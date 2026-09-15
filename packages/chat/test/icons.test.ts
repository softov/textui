import { describe, expect, it } from 'vitest';
import { settingIcon, valueIcon } from '../src/index.js';

/**
 * The marks beside a setting and beside its values.
 *
 * A setting always gets one; a value only when it is the kind of value a mark
 * tells apart, or when the caller asks for the neutral dot anyway.
 */

describe('setting icons', () => {
  it('match on the key, or on the title when the key says nothing', () => {
    expect(settingIcon('full', 'model')).toBe('◇');
    expect(settingIcon('full', 'x1', 'Approval mode')).toBe('◉');
  });

  it('fall back to a mark rather than to nothing', () => {
    expect(settingIcon('full', 'something-else')).toBe('▪');
    expect(settingIcon('ascii', 'something-else')).toBe('-');
  });

  it('drop to ascii with the terminal', () => {
    expect(settingIcon('ascii', 'model')).toBe('#');
    expect(settingIcon('ascii', 'branch')).toBe('Y');
  });
});

describe('value icons', () => {
  it('order the approval modes from asks-everything to asks-nothing', () => {
    expect(valueIcon('full', 'default', 'Ask before edits')).toBe('?');
    expect(valueIcon('full', 'acceptEdits')).toBe('✓');
    expect(valueIcon('full', 'plan')).toBe('≡');
    expect(valueIcon('full', 'bypassPermissions')).toBe('⚠');
  });

  it('test the value before the label', () => {
    // Both contain "auto"; only the value decides.
    expect(valueIcon('full', 'bypassPermissions', 'Auto approve')).toBe('⚠');
  });

  it('are absent for a value that is not a mode, unless a dot is asked for', () => {
    expect(valueIcon('full', 'feature/xyz')).toBeUndefined();
    expect(valueIcon('full', 'feature/xyz', undefined, { fallback: true })).toBe('·');
    expect(valueIcon('ascii', 'feature/xyz', undefined, { fallback: true })).toBe('-');
  });
});
