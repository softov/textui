import { describe, expect, it } from 'vitest';
import { isDataBinding } from '../src/types/graph.js';

// `{ path }` is the whole type, so anything carrying a `path` beside other
// keys is somebody's data, not a binding. Claiming it resolved a socket
// address against the store and threw:
//
//   PathError: relative path used with no data context: /tmp/xyz/room
describe('what counts as a binding', () => {
  it('is exactly one key called path', () => {
    expect(isDataBinding({ path: '$/a/b' })).toBe(true);
    expect(isDataBinding({ path: '/relative' })).toBe(true);
  });

  for (const value of [
    { kind: 'unix', path: '/tmp/room' },
    { path: '/etc/hosts', size: 12 },
    { component: 'Row', path: '$/a' },
    { template: { component: 'Row' }, path: '$/rows' },
  ]) {
    it(`is not ${JSON.stringify(value)}`, () => {
      expect(isDataBinding(value)).toBe(false);
    });
  }

  it('is not a path that is missing or not a string', () => {
    expect(isDataBinding({})).toBe(false);
    expect(isDataBinding({ path: 3 })).toBe(false);
    expect(isDataBinding(null)).toBe(false);
    expect(isDataBinding('$/a')).toBe(false);
  });
});
