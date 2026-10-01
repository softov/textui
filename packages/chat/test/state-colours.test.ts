import { describe, expect, it } from 'vitest';
import type { Color } from '@textui/core';
import { h } from '@textui/core';
import { renderApp } from '@textui/testing';
import type { Harness } from '@textui/testing';
import { ComposerBar, ReasoningBlock, ToolCallRow, chipId } from '../src/index.js';
import type { ComposerOption } from '../src/index.js';

/**
 * The names a theme states on this package's components are reachable.
 *
 * The same check as `packages/testing/test/state-override.test.ts`, for the
 * three components that live here and cannot be mounted from there. A
 * `components` entry nothing reads is the failure this catches: a theme
 * author restates `ToolCallRow.selected`, the theme saves, and the row on
 * screen does not move.
 *
 * These are the chat shapes where the selection is a whole row - a tool row,
 * a reasoning header - and the one where it is the focus alone. The pairing
 * travels with the fill, which is why a restated `fg` is worth checking too.
 */

const under = (t: Harness, text: string): Color | undefined => {
  const lines = t.lines();
  for (let y = 0; y < lines.length; y++) {
    const x = (lines[y] as string).indexOf(text);
    if (x >= 0) return t.app.buffer().get(x, y)?.bg;
  }
  throw new Error(`no text "${text}" on screen`);
};

const hex = (color: Color | undefined): string | undefined => {
  if (!color || typeof color !== 'object' || !('rgb' in color)) return undefined;
  return `#${color.rgb.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
};

const bgUnder = (t: Harness, text: string): string | undefined => hex(under(t, text));

const fgUnder = (t: Harness, text: string): string | undefined => {
  const lines = t.lines();
  for (let y = 0; y < lines.length; y++) {
    const x = (lines[y] as string).indexOf(text);
    if (x >= 0) return hex(t.app.buffer().get(x, y)?.fg);
  }
  throw new Error(`no text "${text}" on screen`);
};

const OPTIONS: ComposerOption[] = [
  { id: 'harness', label: 'Harness', commandId: 'set.harness' },
  { id: 'model', label: 'Model', commandId: 'set.model' },
];

describe('a tool row', () => {
  const call = {
    id: 'c1',
    name: 'search',
    status: 'completed' as const,
    invocation: 'search for the token',
  };

  const open = async (active: boolean): Promise<Harness> => {
    const t = await renderApp({
      width: 60,
      height: 8,
      theme: 'dark',
      root: h(ToolCallRow, { call, active }),
    });
    await t.settle();
    return t;
  };

  it('takes the fill the theme states for `ToolCallRow.selected`', async () => {
    const t = await open(true);
    expect(bgUnder(t, 'search')).toBe('#1f6feb');
    await t.unmount();
  });

  it('and writes on it in the colour the same entry states', async () => {
    // The pairing is the point. A row filled with `selected` and drawn in the
    // terminal's own foreground is a row nobody can read, and restating the
    // fill alone must not be able to produce one.
    const t = await open(true);
    expect(fgUnder(t, 'search')).toBe('#0d1117');
    await t.unmount();
  });

  it('states no colour on the node, which is what leaves it to the theme', async () => {
    const t = await open(true);
    const row = t.getAllByRole('row').find((el) => el.props.selected === true);
    expect(row?.props.bg).toBeUndefined();
    expect(row?.props.fg).toBeUndefined();
    await t.unmount();
  });

  it('is left on the canvas when it is not the one under the cursor', async () => {
    const t = await open(false);
    expect(bgUnder(t, 'search')).not.toBe('#1f6feb');
    await t.unmount();
  });
});

describe('a reasoning header', () => {
  it('takes the same fill the tool row does', async () => {
    const t = await renderApp({
      width: 60,
      height: 8,
      theme: 'dark',
      root: h(ReasoningBlock, { content: 'one two three', summary: 'thinking', active: true }),
    });
    await t.settle();
    expect(bgUnder(t, 'thinking')).toBe('#1f6feb');
    await t.unmount();
  });
});

describe('a composer chip', () => {
  it('takes `ComposerChip.focus`, and only when the keyboard is on it', async () => {
    const t = await renderApp({
      width: 60,
      height: 8,
      theme: 'dark',
      root: h(ComposerBar, {
        options: OPTIONS,
        onOpen: () => undefined,
        onSend: () => undefined,
      }),
    });
    await t.settle();

    expect(bgUnder(t, 'Harness')).not.toBe('#1f6feb');

    t.app.focus.focus(chipId('harness'));
    await t.settle();
    // A chip has no selection of its own - it is the focused one or it is not
    // there - so the theme states the fill under `focus` and nothing is
    // painted when the keyboard is elsewhere.
    expect(bgUnder(t, 'Harness')).toBe('#1f6feb');

    t.app.focus.focus(chipId('model'));
    await t.settle();
    expect(bgUnder(t, 'Harness')).not.toBe('#1f6feb');
    expect(bgUnder(t, 'Model')).toBe('#1f6feb');
    await t.unmount();
  });
});