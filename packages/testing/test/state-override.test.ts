import { describe, expect, it } from 'vitest';
import type { Color, ColorDepth, SemanticRole, ThemeDefinition } from '@textui/core';
import { BUILTIN_THEMES, downsample, h, packRgb, unpackRgb, useState } from '@textui/core';
import { CodeViewer, List, Menu, Table, Tabs, TextArea, Tree } from '@textui/widgets';
import { renderApp } from '../src/index.js';
import type { Harness } from '../src/index.js';

/**
 * A theme states a component's state colours where the component is.
 *
 * The claim under test is narrow, and is the whole reason the colours moved
 * out of the node props: changing one component's selection moves that
 * component and nothing else. A global token cannot do that. Restating
 * `selected` repaints every list, tree, table, menu and tab in the
 * application at once, which is the coupling this put an end to.
 *
 * The second half is that the built-in entries are reachable at all. A
 * `components` name nothing reads is a theme author's edit that appears to
 * work: the colour is written, the theme saves, and the row on screen does
 * not move. So each of these mounts the real component, puts it in the state,
 * and reads the cell. A name that stopped being stated anywhere shows up as a
 * row on the canvas.
 *
 * `ToolCallRow`, `ReasoningBlock` and `ComposerChip` are checked where they
 * are drawn, in `packages/chat`; `Editor` in `packages/documents`. This
 * package cannot see those, and a check that only read the names would pass on
 * all of them without proving anything.
 */

const MARK = '#5a1e8c';

const OVERRIDE: ThemeDefinition = {
  id: 'one-component',
  name: 'One component',
  appearance: 'dark',
  extends: 'dark',
  colors: {},
  components: { List: { focus: { bg: MARK, fg: '#ffffff' } } },
};

/**
 * The `nth` cell holding `text`, as `[r, g, b]`, or nothing if it has no
 * colour there.
 *
 * `nth` because these tests put the same word on screen twice on purpose -
 * a list above a table, a field beside a list - and which one a colour came
 * from is the whole of what they are checking.
 */
const cellAt = (
  t: Harness,
  text: string,
  channel: 'fg' | 'bg',
  nth = 0,
): number[] | undefined => {
  const lines = t.lines();
  let seen = 0;
  for (let y = 0; y < lines.length; y++) {
    let from = 0;
    for (;;) {
      const x = (lines[y] as string).indexOf(text, from);
      if (x < 0) break;
      if (seen === nth) {
        const color = t.app.buffer().get(x, y)?.[channel] as Color | undefined;
        return color && typeof color === 'object' && 'rgb' in color
          ? (color as { rgb: number[] }).rgb
          : undefined;
      }
      seen += 1;
      from = x + 1;
    }
  }
  throw new Error(`no occurrence ${nth} of "${text}" on screen`);
};

/** The background under a piece of text, as the theme stated it. */
const bgUnder = (t: Harness, text: string, nth = 0): number[] | undefined =>
  cellAt(t, text, 'bg', nth);

const fgUnder = (t: Harness, text: string, nth = 0): number[] | undefined =>
  cellAt(t, text, 'fg', nth);

const hexOf = (rgb: number[] | undefined): string | undefined =>
  rgb && `#${rgb.map((v) => v.toString(16).padStart(2, '0')).join('')}`;

const ROWS = [
  { id: 'a', label: 'Alpha' },
  { id: 'b', label: 'Bravo' },
];

const mount = async (
  root: NonNullable<Parameters<typeof renderApp>[0]>['root'],
  options: { theme?: string; themes?: ThemeDefinition[] } = {},
): Promise<Harness> => {
  const t = await renderApp({
    width: 44,
    height: 16,
    root,
    ...(options.theme ? { theme: options.theme } : {}),
    ...(options.themes ? { themes: options.themes } : {}),
  });
  await t.settle();
  return t;
};

/**
 * Put the keyboard on a component by the role it draws.
 *
 * `Table` takes focus the ordinary way and says nothing about wanting it on
 * mount, so a table alone on a screen has nothing focused. Reaching it by its
 * drawn role rather than by a guessed id is what keeps that from being a
 * detail this test has to know.
 */
const focusRole = async (t: Harness, role: SemanticRole): Promise<void> => {
  const el = t.getAllByRole(role)[0];
  if (!el) throw new Error(`no ${role} on screen`);
  t.focus(el.id);
  await t.settle();
};

/** A list above a table, both with `Bravo` selected and neither auto-focusing. */
const listOverTable = () =>
  h('box', { direction: 'column', width: 44 },
    h(List, { items: ROWS, selectedId: 'b', focusId: 'list' }),
    h(Table, {
      columns: [{ key: 'label', header: 'Name' }],
      rows: ROWS,
      selectedKey: 'b',
    }));

describe('a theme override', () => {
  it('moves the component it names and leaves a neighbour holding the same state alone', async () => {
    // Two components, both with `Bravo` selected. The theme restates one of
    // them, in the focused state only.
    const t = await mount(listOverTable(), {
      themes: [...BUILTIN_THEMES, OVERRIDE], theme: 'one-component',
    });

    await focusRole(t, 'list');
    // The first `Bravo` on screen is the list's, and it took the override.
    // The second is the table's, and did not: the table has no keyboard, so it
    // is at `Table.selected`, and `List.focus` says nothing about a table.
    expect(hexOf(bgUnder(t, 'Bravo'))).toBe(MARK);
    expect(hexOf(bgUnder(t, 'Bravo', 1))).toBe('#264466');

    await focusRole(t, 'table');
    // Now the table has the keyboard and takes the built-in `Table.focus`,
    // while the list falls back to the built-in `List.selected` rather than
    // holding on to the override it was only ever given for the live state.
    expect(hexOf(bgUnder(t, 'Bravo'))).toBe('#264466');
    expect(hexOf(bgUnder(t, 'Bravo', 1))).toBe('#1f6feb');
    await t.unmount();
  });

  it('does not reach a component that states no such name', async () => {
    // The whole claim in one line: a theme that restates one component's
    // selection is a theme that changed one component.
    const t = await mount(listOverTable(), {
      themes: [...BUILTIN_THEMES, OVERRIDE], theme: 'one-component',
    });
    await focusRole(t, 'list');

    expect(hexOf(bgUnder(t, 'Bravo'))).toBe(MARK);
    expect(hexOf(bgUnder(t, 'Bravo', 1))).not.toBe(MARK);
    await t.unmount();
  });

  it('reaches the focused state only, and leaves the unfocused selection below it', async () => {
    // `List.focus` and `List.selected` are two answers on purpose: the same
    // component, the same row, with and without the keyboard. An override of
    // one must not quietly repaint the other.
    const t = await mount(
      h('box', { direction: 'column', width: 44 },
        h(List, { items: ROWS, selectedId: 'b', autoFocus: true, focusId: 'list' }),
        h(List, { items: ROWS, selectedId: 'b', focusable: false })),
      { themes: [...BUILTIN_THEMES, OVERRIDE], theme: 'one-component' },
    );

    const selected = t.getAllByRole('listitem').filter((el) => el.props.selected === true);
    const focused = selected.filter((el) => el.rect);
    const fills = focused.map((el) =>
      hexOf((t.app.buffer().get(el.rect?.x ?? 0, el.rect?.y ?? 0)?.bg as { rgb: number[] } | undefined)?.rgb));
    expect(fills).toEqual([MARK, '#264466']);
    await t.unmount();
  });
});

describe("a name the built-in themes state", () => {
  it('is one the list reaches, in both states', async () => {
    const focused = await mount(h(List, { items: ROWS, selectedId: 'b', autoFocus: true, focusId: 'list' }), { theme: 'dark' });
    expect(hexOf(bgUnder(focused, 'Bravo'))).toBe('#1f6feb');
    await focused.unmount();

    const resting = await mount(h(List, { items: ROWS, selectedId: 'b', focusable: false }), { theme: 'dark' });
    expect(hexOf(bgUnder(resting, 'Bravo'))).toBe('#264466');
    await resting.unmount();
  });

  it('is one the tree reaches, in both states', async () => {
    const nodes = [{ id: 'a', label: 'Alpha', children: [{ id: 'a1', label: 'Alphette' }] }];
    const focused = await mount(
      h(Tree, { nodes, selectedId: 'a', expandedIds: ['a'], autoFocus: true, focusId: 'tree' }), { theme: 'dark' });
    expect(hexOf(bgUnder(focused, 'Alpha'))).toBe('#1f6feb');
    await focused.unmount();

    const resting = await mount(
      h(Tree, { nodes, selectedId: 'a', expandedIds: ['a'], focusable: false }), { theme: 'dark' });
    expect(hexOf(bgUnder(resting, 'Alpha'))).toBe('#264466');
    await resting.unmount();
  });

  it('is one the table reaches, in both states', async () => {
    const columns = [{ key: 'label', header: 'Name' }];
    const focused = await mount(h(Table, { columns, rows: ROWS, selectedKey: 'b' }), { theme: 'dark' });
    await focusRole(focused, 'table');
    expect(hexOf(bgUnder(focused, 'Bravo'))).toBe('#1f6feb');
    await focused.unmount();

    const resting = await mount(
      h(Table, { columns, rows: ROWS, selectedKey: 'b', focusable: false }), { theme: 'dark' });
    expect(hexOf(bgUnder(resting, 'Bravo'))).toBe('#264466');
    await resting.unmount();
  });

  it('is one the menu reaches, in both states', async () => {
    const items = [{ id: 'a', label: 'Alpha' }, { id: 'b', label: 'Bravo' }];
    const focused = await mount(h(Menu, { items, activeId: 'b', autoFocus: true, focusId: 'menu' }), { theme: 'dark' });
    expect(hexOf(bgUnder(focused, 'Bravo'))).toBe('#1f6feb');
    await focused.unmount();

    const resting = await mount(h(Menu, { items, activeId: 'b' }), { theme: 'dark' });
    expect(hexOf(bgUnder(resting, 'Bravo'))).toBe('#264466');
    await resting.unmount();
  });

  it('is one the code viewer reaches, and its focused fill is one step down from a selection', async () => {
    const source = 'one\ntwo\nthree\nfour';
    const marked = await mount(h(CodeViewer, { content: source, highlight: [1] }), { theme: 'dark' });
    expect(hexOf(bgUnder(marked, 'one'))).toBe('#264466');
    await marked.unmount();

    // The caret line is the selection with the keyboard on it, so it takes
    // the next fill up rather than a colour of its own.
    const onCaret = await mount(
      h(CodeViewer, { content: source, line: 2, autoFocus: true }), { theme: 'dark' });
    expect(hexOf(bgUnder(onCaret, 'two'))).toBe('#1f2937');
    await onCaret.unmount();
  });

  it('is one the text field reaches, in both states', async () => {
    // A field and a list, because the unfocused case is not a field on its
    // own: a field with nothing else on the screen has either the keyboard or
    // no focus at all, and a click puts the keyboard in it.
    const open = async (): Promise<Harness> => {
      const t = await renderApp({
        width: 40,
        height: 12,
        root: h('box', { direction: 'column', width: 40 },
          h(List, { items: ROWS, selectedId: 'b', focusId: 'list' }),
          h(function Field() {
            const [text, setText] = useState('hello world');
            return h(TextArea, { value: text, onChange: setText, blink: false, focusId: 'field' });
          }, {})),
        theme: 'dark',
      });
      await t.settle();
      // The field's selection is made, not declared, so this is the honest
      // way to reach it: click into the field to put the caret at the start,
      // then shift along it.
      t.focus('field');
      await t.settle();
      t.click(0, 2);
      await t.settle();
      t.pressAll('shift+right', 'shift+right', 'shift+right');
      await t.settle();
      return t;
    };

    const focused = await open();
    expect(hexOf(bgUnder(focused, 'hel'))).toBe('#1f6feb');
    await focused.unmount();

    // The same selection with the list holding the keyboard. A selection left
    // visible in an unfocused field says what is on the clipboard, and saying
    // it as loudly as the live one puts two selections on the screen.
    const resting = await open();
    resting.focus('list');
    await resting.settle();
    expect(hexOf(bgUnder(resting, 'hel'))).toBe('#264466');
    await resting.unmount();
  });

  it('is one the tab strip reaches, and only the solid variant is filled', async () => {
    // The one place a state is qualified by a variant. `Tabs.selected` gives
    // the foreground and `Tabs.solid.selected` adds the fill, because a filled
    // underline tab has two answers to "which one is open".
    const items = [{ id: 'a', label: 'Alpha' }, { id: 'b', label: 'Bravo' }];
    const solid = await mount(
      h(Tabs, { items, activeId: 'b', variant: 'solid', autoFocus: true, focusId: 'tabs' }), { theme: 'dark' });
    expect(hexOf(bgUnder(solid, 'Bravo'))).toBe('#1f6feb');
    await solid.unmount();

    const underline = await mount(
      h(Tabs, { items, activeId: 'b', variant: 'underline', autoFocus: true, focusId: 'tabs' }), { theme: 'dark' });
    expect(hexOf(bgUnder(underline, 'Bravo'))).not.toBe('#1f6feb');
    await underline.unmount();
  });
});
/**
 * The pair, checked the way it is actually seen.
 *
 * The two relations below are the whole of what a selection has to do, and
 * neither of them holds by construction - both were reachable before, by
 * stating a `bg` on a node and leaving the `fg` to whatever was there:
 *
 * - the focused fill and the remembered one are told apart. A pane that has
 *   lost the keyboard still shows where its selection is, and drawing that as
 *   loudly as the live one puts two cursors on the screen.
 * - the foreground is not the fill. A filled row drawn in the fill's own
 *   colour is a filled row nobody can read, and "the row is highlighted" is
 *   then a thing only the frame buffer knows.
 *
 * Run at eight colours as well as twenty-four, because that is where they
 * stop holding on their own. Two fills chosen for how they look at full
 * depth can land on the same one of sixteen, and a foreground chosen to read
 * on a fill can land on it too.
 */
describe('a selection pair', () => {
  /** The colour a terminal at `depth` would actually put on the screen. */
  const onScreen = (rgb: number[] | undefined, depth: ColorDepth): string | undefined => {
    if (!rgb) return undefined;
    const [r, g, b] = rgb;
    const packed = downsample(packRgb(r ?? 0, g ?? 0, b ?? 0), depth);
    const [rr, gg, bb] = unpackRgb(packed);
    return `#${[rr, gg, bb].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
  };

  for (const theme of ['dark', 'light']) {
    for (const colorDepth of [24, 8] as const) {
      it(`tells a live selection from a remembered one in ${theme} at ${colorDepth} colours`, async () => {
        const caps = { colorDepth };
        const live = await renderApp({
          width: 40, height: 8, theme, capabilities: caps,
          root: h(List, { items: ROWS, selectedId: 'b', autoFocus: true, focusId: 'list' }),
        });
        await live.settle();

        const remembered = await renderApp({
          width: 40, height: 8, theme, capabilities: caps,
          root: h(List, { items: ROWS, selectedId: 'b', focusable: false }),
        });
        await remembered.settle();

        const liveFill = onScreen(bgUnder(live, 'Bravo'), colorDepth);
        const rememberedFill = onScreen(bgUnder(remembered, 'Bravo'), colorDepth);

        expect(liveFill, `${theme}: the focused row has no fill at all`).toBeDefined();
        expect(
          liveFill,
          `${theme} at ${colorDepth}: the live and remembered selections are both ${String(liveFill)}, so there is nothing to see`,
        ).not.toBe(rememberedFill);

        for (const [name, harness] of [['live', live], ['remembered', remembered]] as const) {
          expect(
            onScreen(fgUnder(harness, 'Bravo'), colorDepth),
            `${theme} at ${colorDepth}: the ${name} row is written in its own fill`,
          ).not.toBe(onScreen(bgUnder(harness, 'Bravo'), colorDepth));
        }

        await live.unmount();
        await remembered.unmount();
      });
    }
  }
});
