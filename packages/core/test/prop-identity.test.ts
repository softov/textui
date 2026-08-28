import { describe, expect, it } from 'vitest';
import { resolveProps } from '../src/runtime/bindings.js';
import { createStore } from '../src/core/store.js';

/*
 * Identity is what the reconciler compares.
 *
 * A component whose props are all unchanged is not re-run, and neither is
 * anything under it - so a list prop copied on the way in made that test
 * impossible to pass for exactly the props worth passing it for. A feed of
 * four hundred rows arrived as a new array on every pass and re-rendered the
 * lot, whatever its caller had memoised.
 *
 * The copy is still there for the bindings, which is what it was for.
 */
describe('resolving props', () => {
  const ctx = () => {
    const store = createStore();
    store.set('$/who', 'world');
    return {
      store,
      reads: new Set<string>(),
      execute: () => undefined,
      emit: () => undefined,
    };
  };

  it('hands back the same array when there was nothing in it to resolve', () => {
    const rows = [{ id: 'a' }, { id: 'b' }];
    const out = resolveProps(ctx() as never, { component: 'row', rows });
    expect(out.rows).toBe(rows);
  });

  it('hands back the same object too', () => {
    const expanded = { 'a:1': true };
    const out = resolveProps(ctx() as never, { component: 'tree', expanded });
    expect(out.expanded).toBe(expanded);
  });

  it('still resolves a binding inside one, and says so with a new array', () => {
    const rows = [{ path: '$/who' }];
    const out = resolveProps(ctx() as never, { component: 'row', rows });
    expect(out.rows).not.toBe(rows);
    expect(out.rows).toEqual(['world']);
  });
});
