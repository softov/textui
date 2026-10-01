import { describe, expect, it } from 'vitest';
import { h } from '@textui/core';
import type { CapabilityOverrides } from '@textui/core';
import { FONTS, FontText, banner, fontAt, inkGlyphs } from '@textui/widgets';
import { renderApp } from '../src/index.js';
import type { Harness } from '../src/index.js';

/**
 * The letters, as drawn.
 *
 * `FontText` is the shape half of the pair: it answers with a `text` node and
 * inherits its colour like one, so there is nothing here about ink. What is
 * worth asserting is the mapping the component owns - the placeholders filled
 * from the theme, the ascii downgrade, the font's own fallback - and the
 * wrapping, which is the one decision made on the *text* rather than the block.
 */

const BLOCK = FONTS.find((f) => f.id === 'block') ?? (FONTS[0] as (typeof FONTS)[number]);

const open = async (
  props: Record<string, unknown>,
  options: { width?: number; height?: number; capabilities?: CapabilityOverrides } = {},
): Promise<Harness> => {
  const t = await renderApp({
    width: options.width ?? 40,
    height: options.height ?? 12,
    theme: 'dark',
    ...(options.capabilities ? { capabilities: options.capabilities } : {}),
    root: h(FontText, { content: 'A', ...props }),
  });
  await t.settle();
  await t.settle();
  return t;
};

/** The frame without the status line and the blank under it. */
const drawn = (t: Harness): string[] =>
  t.lines().filter((line) => !line.includes('textui') && !line.includes('panels'));

describe('FontText', () => {
  it('draws letters rather than the string', async () => {
    const t = await open({ content: 'A' });
    const rows = drawn(t).filter((row) => row.trim() !== '');
    // Five rows high, and made of the theme's full block rather than a letter.
    expect(rows).toHaveLength(5);
    expect(rows[0]).toContain('█');
    expect(rows.join('')).not.toContain('A');
    await t.unmount();
  });

  it('fills the placeholders from the theme', async () => {
    const t = await open({ content: 'A' });
    const all = drawn(t).join('\n');
    // `#` is a full cell and `%` a lighter one; neither is drawn as itself.
    expect(all).not.toContain('#');
    expect(all).not.toContain('%');
    await t.unmount();
  });

  it('downgrades to the glyphs the ascii theme has', async () => {
    const unicode = drawn(await open({ content: 'A' })).join('\n');
    const ascii = drawn(await open({ content: 'A' }, { capabilities: { unicode: 'ascii' } })).join('\n');
    // The letters are the same shape; what changes is what a full cell is
    // drawn with - which is the theme's answer, not the font's.
    expect(unicode).toContain('█');
    expect(ascii).not.toContain('█');
    expect(ascii).toContain('#');
    // And a placeholder the terminal cannot draw is never a question mark.
    expect(ascii).not.toContain('?');
  });

  it('uses the font its own fallback names, where it has one', async () => {
    const tmplt = fontAt('tmplt');
    expect(tmplt.fallback).toBeDefined();
    const ascii = { unicode: 'ascii' } as CapabilityOverrides;

    const withFallback = drawn(await open({ content: 'A', font: tmplt }, { capabilities: ascii })).join('\n');
    const stand = drawn(await open({ content: 'A', font: fontAt(tmplt.fallback as string) }, { capabilities: ascii })).join('\n');
    expect(withFallback).toBe(stand);
  });

  it('leaves a character the font has no glyph for as a gap', async () => {
    const alone = drawn(await open({ content: 'A' })).join('\n');
    const spaced = drawn(await open({ content: 'A~A' })).join('\n');
    // Wider, and with the middle left empty rather than closed up.
    const width = (s: string): number => Math.max(...s.split('\n').map((l) => l.length));
    expect(width(spaced)).toBeGreaterThan(width(alone));
    expect(spaced).toContain('  ');
  });

  it('breaks the words, not the block, when asked to wrap', async () => {
    const t = await open({ content: 'TextUI rocks', wrap: 'word' }, { width: 24, height: 20 });
    const rows = drawn(t).filter((row) => row.trim() !== '');
    // More rows than one line of letters, and none of them wider than the box:
    // the break went between the words, in the font, before anything was drawn.
    expect(rows.length).toBeGreaterThan(BLOCK.glyphs['A']?.length ?? 5);
    for (const row of rows) expect(row.length).toBeLessThanOrEqual(24);
    await t.unmount();
  });

  it('puts the gap the caller asks for between lines', async () => {
    const frame = async (lineGap: number): Promise<string[]> => {
      const t = await open({ content: 'A\nB', lineGap }, { width: 30, height: 24 });
      const lines = t.lines().map((line) => line.trimEnd());
      await t.unmount();
      while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
      return lines;
    };
    // Two lines of five rows, and the empty rows between them are the count:
    // 0 butts them together, 1 is the default, 2 is air.
    const between = (lines: string[]): number =>
      lines.slice(BLOCK.glyphs['A']?.length ?? 5, -(BLOCK.glyphs['A']?.length ?? 5))
        .filter((line) => line === '').length;

    expect(between(await frame(0))).toBe(0);
    expect(between(await frame(1))).toBe(1);
    expect(between(await frame(2))).toBe(2);
  });

  it('draws the block the engine drew, whatever the caller puts in rest', async () => {
    // The regression this exists for: `wrap` on a `text` cuts the drawn block
    // at a column, so a caller who reached for it got rows of half letters. The
    // rows drawn are `banner`'s, line for line, at the width of the box.
    const text = 'Terminal Interface';
    const width = 22;
    // Tall enough for the broken block: the box clips, it does not prove
    // anything about the wrapping.
    const t = await open({ content: text, wrap: 'word' }, { width, height: 40 });

    const want = banner(text, BLOCK, inkGlyphs(t.app.theme.glyphs, true), width)
      .split('\n').map((line) => line.trimEnd());
    const got = t.lines().map((line) => line.trimEnd()).filter((line) => line !== '');
    expect(got).toEqual(want.filter((line) => line !== ''));
    await t.unmount();
  });
});
