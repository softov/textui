import { describe, expect, it } from 'vitest';
import { createStore } from '../src/core/store.js';
import { createWhen } from '../src/core/when.js';

function setup() {
  const store = createStore();
  return { store, when: createWhen(store) };
}

describe('when clauses', () => {
  it('an empty clause is always true', () => {
    const { when } = setup();
    expect(when.evaluate(undefined)).toBe(true);
    expect(when.evaluate('')).toBe(true);
  });

  it('reads store paths', () => {
    const { store, when } = setup();
    store.set('$/session/role', 'admin');
    expect(when.evaluate("$/session/role == 'admin'")).toBe(true);
    expect(when.evaluate("$/session/role == 'guest'")).toBe(false);
  });

  it('handles truthiness and negation', () => {
    const { store, when } = setup();
    store.set('$/ui/sidebar/collapsed', false);
    expect(when.evaluate('!$/ui/sidebar/collapsed')).toBe(true);
    expect(when.evaluate('$/ui/sidebar/collapsed')).toBe(false);
  });

  it('combines with && and ||', () => {
    const { store, when } = setup();
    store.set('$/modus/capabilities/mouse', true);
    store.set('$/ui/sidebar/collapsed', false);
    expect(when.evaluate('$/modus/capabilities/mouse && !$/ui/sidebar/collapsed')).toBe(true);
    expect(when.evaluate('$/nothing || $/modus/capabilities/mouse')).toBe(true);
  });

  it('compares numbers', () => {
    const { store, when } = setup();
    store.set('$/modus/size/width', 120);
    expect(when.evaluate('$/modus/size/width >= 100')).toBe(true);
    expect(when.evaluate('$/modus/size/width < 100')).toBe(false);
  });

  it('honours parentheses', () => {
    const { store, when } = setup();
    store.set('$/a', true);
    store.set('$/b', false);
    store.set('$/c', true);
    expect(when.evaluate('$/a && ($/b || $/c)')).toBe(true);
    expect(when.evaluate('($/a && $/b) || $/c')).toBe(true);
  });

  it('matches with a regex', () => {
    const { store, when } = setup();
    store.set('$/file/name', 'notes.md');
    expect(when.evaluate("$/file/name =~ '\\.md$'")).toBe(true);
  });

  it('reads context keys', () => {
    const { when } = setup();
    when.setContext('platform', 'linux');
    expect(when.evaluate("platform == 'linux'")).toBe(true);
    expect(when.evaluate("platform == 'darwin'")).toBe(false);
  });

  it('reports the paths a clause depends on', () => {
    const { when } = setup();
    expect(when.dependencies("$/a/b == 'x' && $/c")).toEqual(['$/a/b', '$/c']);
  });

  it('renders visible rather than hiding chrome on a bad clause', () => {
    const { when } = setup();
    expect(when.evaluate('$/a &&&')).toBe(true);
  });
});
