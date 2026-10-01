import { describe, expect, it } from 'vitest';
import { registerBuiltins } from '@textui/widgets';
import { renderApp } from '@textui/testing';
import type { Harness } from '@textui/testing';
import { registerDocuments } from '../src/index.js';

/**
 * The editor's selection takes the fill the theme states for it.
 *
 * `components.Editor.selected` is the one built-in entry that states a
 * background and no foreground, and deliberately so: a selection in a source
 * file has to be a wash *under* the syntax colours, and a foreground here
 * would paint over whatever token the cells hold.
 *
 * Checked here rather than in `packages/testing`, which cannot mount this
 * component. A `components` entry nothing reads is the failure this catches:
 * a theme restates `Editor.selected`, the theme saves, and nothing moves.
 */

async function settle(t: Harness, n = 3): Promise<void> {
  for (let i = 0; i < n; i++) { await t.settle(); t.flush(); }
}

const bgAt = (t: Harness, x: number, y = 0): string | undefined => {
  const cell = t.app.buffer().get(x, y)?.bg;
  if (!cell || typeof cell !== 'object' || !('rgb' in cell)) return undefined;
  const { rgb } = cell as { rgb: number[] };
  return `#${rgb.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
};

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
  it('is the wash under the selection', async () => {
    const t = await editing(true);
    // `dark`'s `active`, which is the dim end of the selection pair - the
    // same colour an unfocused selection takes, and here deliberately no
    // foreground, so the syntax colours show through it.
    expect(bgAt(t, 0)).toBe('#264466');
    expect(bgAt(t, 2)).toBe('#264466');
    // Past the end of the selection the editor is back to the canvas.
    expect(bgAt(t, 4)).not.toBe('#264466');
    await t.unmount();
  });

  it('paints nothing at all when nothing is selected', async () => {
    const t = await editing(false);
    expect(bgAt(t, 0)).not.toBe('#264466');
    await t.unmount();
  });
});