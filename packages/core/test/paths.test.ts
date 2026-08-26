import { describe, expect, it } from 'vitest';
import { keysTouch } from '../src/util/paths.js';

describe('keysTouch', () => {
  it('matches the same key', () => {
    expect(keysTouch('a/b', 'a/b')).toBe(true);
  });

  it('matches descendants in either direction', () => {
    expect(keysTouch('a/b/c', 'a/b')).toBe(true);
    expect(keysTouch('a/b', 'a/b/c')).toBe(true);
  });

  it('treats the root key as overlapping any concrete descendant', () => {
    expect(keysTouch('', 'a')).toBe(true);
    expect(keysTouch('a/b', '')).toBe(true);
  });

  it('does not match unrelated siblings', () => {
    expect(keysTouch('a/b', 'a/c')).toBe(false);
    expect(keysTouch('metrics/cpu', 'statusbar/agent')).toBe(false);
  });
});
