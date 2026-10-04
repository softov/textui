import { describe, expect, it } from 'vitest';
import { ATTR_INVERSE } from '@textui/core';
import { registerBuiltins } from '@textui/widgets';
import { renderApp } from '@textui/testing';
import type { Harness } from '@textui/testing';
import { registerDocuments } from '../src/index.js';

/**
 * The editor's selection takes the look the theme states for it.
 *
 * `components.Editor.selected` is the one built-in entry that states no
 * colour, and deliberately so: it is reverse video, which keeps the syntax
 * colour of every token it covers and shows whether or not the theme's
 * `active` is a fill. A colour here would paint over whatever token the cells
 * hold.
 *
 * Checked here rather than in `packages/testing`, which cannot mount this
 * component. A `components` entry nothing reads is the failure this catches:
 * a theme restates `Editor.selected`, the theme saves, and nothing moves.
 */

async function settle(t: Harness, n = 3): Promise<void> {
  for (let i = 0; i < n; i++) { await t.settle(); t.flush(); }
}

const inverseAt = (t: Harness, x: number, y = 0): boolean =>
  ((t.app.buffer().get(x, y)?.attrs ?? 0) & ATTR_INVERSE) !== 0;

async function editing(shifted: boolean): Promise<Harness> {
  const t = await renderApp({
    width: 40,
    height: 10,
    theme: 'dark',
    onBoot: (app) => { registerBuiltins(app); registerDocuments(app); },
    root: {
      component: 'box', direction: 'column', flex: 1,
      children: {
        component: 'CodeEditor', flex: 1, value: 'hello world\n', lineNumbers: false,
        onChange: { handler: () => undefined },
      },
    },
  });
  await settle(t);
  t.tab();
  t.flush();
  if (shifted) {
    t.pressAll('shift+right', 'shift+right', 'shift+right');
    await settle(t);
  }
  return t;
}

describe("a theme's `Editor.selected`", () => {
  it('is reverse video over the selection', async () => {
    const t = await editing(true);
    // `dark` has no selection fill, so this is the whole of what shows.
    expect(inverseAt(t, 0)).toBe(true);
    expect(inverseAt(t, 2)).toBe(true);
    // Past the end of the selection the editor is drawn as it was.
    expect(inverseAt(t, 4)).toBe(false);
    await t.unmount();
  });

  it('paints nothing at all when nothing is selected', async () => {
    const t = await editing(false);
    expect(inverseAt(t, 0)).toBe(false);
    await t.unmount();
  });
});