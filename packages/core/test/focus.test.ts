import { describe, expect, it } from 'vitest';
import { createFocus, GLOBAL_SCOPE } from '../src/core/focus.js';

/**
 * Whose focus a scope may move.
 *
 * Its own. A scope closing used to blur whatever held focus, including
 * something outside it - so a sidebar that swaps the screen beside it lost the
 * keyboard on the first arrow press, and the incoming screen claimed it. The
 * sidebar could be moved exactly once.
 */
describe('closing a scope', () => {
  const setup = () => {
    const focus = createFocus();
    focus.registerScope({ id: 'panel', restore: true });
    return focus;
  };

  it('leaves focus alone when it is outside', () => {
    const focus = setup();
    focus.register({ id: 'outside' });
    focus.activateScope('panel');
    focus.register({ id: 'inside', scopeId: 'panel' });

    focus.focus('outside');
    focus.deactivateScope('panel');

    expect(focus.focused()).toBe('outside');
  });

  it('restores what it was opened over when it was holding focus', () => {
    const focus = setup();
    focus.register({ id: 'opener' });
    focus.focus('opener');

    focus.activateScope('panel');
    focus.register({ id: 'inside', scopeId: 'panel' });
    focus.focus('inside');

    focus.deactivateScope('panel');
    expect(focus.focused()).toBe('opener');
  });

  it('restores when its contents have already gone', () => {
    const focus = setup();
    focus.register({ id: 'opener' });
    focus.focus('opener');

    focus.activateScope('panel');
    const inside = focus.register({ id: 'inside', scopeId: 'panel' });
    focus.focus('inside');

    // What usually happens: the scope's contents unmount first, so by the
    // time the scope deactivates nothing holds focus at all.
    inside.dispose();
    expect(focus.focused()).toBeNull();

    focus.deactivateScope('panel');
    expect(focus.focused()).toBe('opener');
  });

  it('takes focus for a scope that asked, as its first control arrives', () => {
    const focus = createFocus();
    focus.registerScope({ id: 'screen:detail', autoFocus: true });
    focus.activateScope('screen:detail');
    expect(focus.focused()).toBeNull();

    focus.register({ id: 'first', scopeId: 'screen:detail' });
    focus.register({ id: 'second', scopeId: 'screen:detail' });

    // A scope is empty when it is activated: its contents register on the way
    // up, so claiming at activation could only ever find nothing.
    expect(focus.focused()).toBe('first');
    expect(focus.scopeOf('first')).toBe('screen:detail');
  });

  it('passes over a handler that is not somewhere focus can land', () => {
    const focus = createFocus();
    focus.registerScope({ id: 'screen:detail', autoFocus: true });
    focus.activateScope('screen:detail');

    // A `global` handler is a focusable - that is how a layer reads escape
    // without holding focus - and it registers before the controls, because
    // it belongs to the component that contains them. Handed the focus it
    // consumes nothing, so the keys fall through to whatever is behind, and
    // every real control's own `autoFocus` then stands down: it claims focus
    // only when the scope does not already hold it.
    focus.register({ id: 'keys', scopeId: 'screen:detail', skipTab: true, global: true });
    expect(focus.focused()).toBeNull();

    focus.register({ id: 'field', scopeId: 'screen:detail' });
    expect(focus.focused()).toBe('field');
  });

  it('does not take focus from something that already has it', () => {
    const focus = createFocus();
    focus.register({ id: 'opener' });
    focus.focus('opener');

    focus.registerScope({ id: 'screen:detail', autoFocus: true });
    focus.activateScope('screen:detail');
    focus.register({ id: 'first', scopeId: 'screen:detail' });

    // The difference between a screen pushed over what had focus - the push
    // unmounts it, leaving none - and a dialog opened while its opener still
    // holds it.
    expect(focus.focused()).toBe('opener');
    expect(GLOBAL_SCOPE).toBe(focus.scopeOf('opener'));
  });
});

/**
 * Who a key is for.
 *
 * The rule is the whole meaning of focus: a focusable reads keys while it is
 * focused, and not otherwise. Dispatch used to offer the event to every
 * registered handler after the focused one declined, which quietly repealed
 * that - and it looked like it worked, because with one list on screen the
 * arrow reached the only thing that wanted it.
 */
describe('dispatch and focus', () => {
  const arrow = { type: 'key', name: 'down' } as never;

  it('does not deliver to a focusable that is not focused', () => {
    const focus = createFocus();
    const seen: string[] = [];
    focus.register({ id: 'a', onKey: () => { seen.push('a'); return true; } });
    focus.register({ id: 'b', onKey: () => { seen.push('b'); return true; } });

    focus.dispatch(arrow);
    expect(seen).toEqual([]);

    focus.focus('b');
    focus.dispatch(arrow);
    expect(seen).toEqual(['b']);
  });

  it('does not hand the key to whichever registered first', () => {
    // Two lists on one page. With nothing focused this used to move the one
    // that mounted earliest, which is not a rule anybody could have predicted
    // from looking at the screen.
    const focus = createFocus();
    const moved: string[] = [];
    focus.register({ id: 'list.a', onKey: () => { moved.push('a'); return true; } });
    focus.register({ id: 'list.b', onKey: () => { moved.push('b'); return true; } });

    focus.dispatch(arrow);
    expect(moved).toEqual([]);

    focus.focus('list.b');
    focus.dispatch(arrow);
    expect(moved).toEqual(['b']);
  });

  it('still delivers to a handler that asked to be global', () => {
    const focus = createFocus();
    const seen: string[] = [];
    focus.register({ id: 'shortcuts', global: true, onKey: () => { seen.push('global'); return true; } });

    focus.dispatch(arrow);
    expect(seen).toEqual(['global']);
  });

  it('offers the focused node the key before any global handler', () => {
    const focus = createFocus();
    const seen: string[] = [];
    focus.register({ id: 'panel', global: true, onKey: () => { seen.push('panel'); return true; } });
    focus.register({ id: 'menu', onKey: () => { seen.push('menu'); return true; } });
    focus.focus('menu');

    // The dropdown panel takes left and right only because the menu inside it
    // declines them - which is the arrangement `global` exists to express.
    focus.dispatch(arrow);
    expect(seen).toEqual(['menu']);
  });

  it('falls through to the global handler when the focused node declines', () => {
    const focus = createFocus();
    const seen: string[] = [];
    focus.register({ id: 'panel', global: true, onKey: () => { seen.push('panel'); return true; } });
    focus.register({ id: 'menu', onKey: () => { seen.push('menu'); return false; } });
    focus.focus('menu');

    focus.dispatch(arrow);
    expect(seen).toEqual(['menu', 'panel']);
  });
});
