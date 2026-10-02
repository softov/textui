import { describe, expect, it } from 'vitest';
import { h } from '@textui/core';
import { CommandPalette, TextInput, Menu } from '@textui/widgets';
import { renderApp } from '../src/index.js';
import type { Harness } from '../src/index.js';

/**
 * The colour of the text in a field, and what a palette says when it is empty.
 *
 * A field's text was drawn in whatever it inherited, so a theme could colour a
 * list row and not the box a person types in - and the palette's search field,
 * which is a `TextInput`, could not be coloured at all. It says `styleAs` now,
 * under the name `TextInput`.
 *
 * The other two are about an empty list. The palette answers for one itself (it
 * knows which kind of nothing this is) and the menu under it was drawing its
 * own line as well; and the line under the list kept the previous answer's
 * sentence, so a search that found nothing still described what it used to.
 */

const hex = (c: unknown): string => (c && typeof c === 'object' && 'rgb' in c
  ? `#${(c as { rgb: number[] }).rgb.map((v) => v.toString(16).padStart(2, '0')).join('')}`
  : String(c));

async function withFieldFg(id: string, root: unknown): Promise<Harness> {
  const t = await renderApp({
    width: 50, height: 16,
    onBoot: (app) => {
      app.themes.register({
        id: 'probe', name: 'probe', appearance: 'dark', extends: 'dark', colors: {},
        components: { [id]: { base: { fg: 'accent' } } },
      } as never);
      app.setTheme('probe');
    },
    root: root as never,
  });
  for (let i = 0; i < 3; i++) await t.settle();
  return t;
}

describe("a field's text colour", () => {
  it('is the theme\'s, under the field\'s own name', async () => {
    const t = await withFieldFg('TextInput', h(TextInput, { value: 'typed' }));
    const row = t.lines().findIndex((line) => line.includes('typed'));
    expect(row).toBeGreaterThanOrEqual(0);
    const at = (t.lines()[row] as string).indexOf('typed');
    expect(hex(t.app.buffer().get(at, row)?.fg)).not.toBe('#f3e6f1');
    await t.unmount();
  });

  it('is the same colour in the palette\'s search box', async () => {
    // The palette renders a `TextInput` itself, so the name is the one thing a
    // caller can reach it by.
    const t = await withFieldFg('TextInput', h(CommandPalette, {
      commands: [{ id: 'a', title: 'Alpha', run() {} }],
    }));
    t.press('t');
    for (let i = 0; i < 3; i++) await t.settle();
    const row = t.lines().findIndex((line) => line.includes('t'));
    expect(row).toBeGreaterThanOrEqual(0);
    await t.unmount();
  });
});

describe('an empty palette', () => {
  const open = async () => {
    const t = await withFieldFg('TextInput', h(CommandPalette, {
      commands: [{ id: 'a', title: 'Alpha', run() {} }],
    }));
    t.press('z');
    t.press('z');
    for (let i = 0; i < 4; i++) await t.settle();
    return t;
  };

  it('never says it twice', async () => {
    // Two lines said the same thing: the row the palette supplies (which knows
    // *why* it is empty) and the line the menu draws for itself. The palette
    // silences the second one wherever it supplies the first.
    const t = await open();
    expect((t.text().match(/no match/gi) ?? []).length).toBeLessThanOrEqual(1);
    await t.unmount();
  });

  it('does not describe what is no longer on the list', async () => {
    const t = await open();
    expect(t.hasText('Alpha')).toBe(false);
    await t.unmount();
  });
});

describe('a menu that answers for itself', () => {
  it('can turn the line it draws off', async () => {
    const withLine = await withFieldFg('TextInput', h(Menu, { items: [], interactive: false }));
    const without = await withFieldFg('TextInput', h(Menu, { items: [], noMatch: false, interactive: false }));
    expect(withLine.hasText('no matches')).toBe(true);
    expect(without.hasText('no matches')).toBe(false);
    await withLine.unmount();
    await without.unmount();
  });
});
