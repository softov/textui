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
