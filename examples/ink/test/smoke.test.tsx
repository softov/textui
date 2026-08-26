import { describe, expect, it } from 'vitest';
import { render } from '@textui/testing';
import type { Harness } from '@textui/testing';
import { FONT, PLAIN, PRESET, TEXT, registerInk } from '../src/app.js';
import { PRESETS } from '../src/inks.js';
import { FONTS, banner, fontAt, inkGlyphs } from '../src/fonts.js';

/**
 * The example, mounted.
 *
 * An example nothing mounts rots quietly, so this stands the whole thing up
 * and drives it. Two sizes, because the panel is the part that has to give: a
 * banner is as wide as the word in it and as tall as its font whatever
 * happens, so a small terminal has to scroll rather than break the layout
 * around it.
 */

const SIZES = [
  { width: 96, height: 30 },
  { width: 74, height: 22 },
];

/** What the default theme draws a banner and its shadow in. */
const FILL = '█';
const SHADE = '░';
/** What the default theme on a unicode terminal draws them in. */
const PEN = inkGlyphs({ progressFull: FILL, progressEmpty: SHADE });
const ASCII_PEN = inkGlyphs({ progressFull: '#', progressEmpty: '-' }, false);

async function open(size = SIZES[0] as { width: number; height: number }): Promise<Harness> {
  const t = await render({ component: 'InkFrame' }, {
    ...size,
    builtins: false,
    onBoot: (app) => { registerInk(app); },
  });
  for (let i = 0; i < 8; i++) await t.settle();
  return t;
}

/** Just the cells the banner is drawn in, so a change to the chrome does not read as a change to it. */
function block(t: Harness): string[] {
  return t.text().split('\n')
    .map((line) => line.replace(new RegExp(`[^${FILL}${SHADE} ]`, 'g'), ' ').trimEnd())
    .filter((line) => line.trim() !== '');
}

describe('the ink example', () => {
  for (const size of SIZES) {
    it(`draws the field, the inks and the banner at ${size.width}x${size.height}`, async () => {
      const t = await open(size);
      expect(t.errors()).toEqual([]);
      // A missing registration draws its own diagnostic rather than nothing,
      // so an empty assertion could never pass by accident.
      expect(t.text()).not.toContain('[textui]');

      expect(t.hasText('sunrise')).toBe(true);
      expect(t.hasText('font')).toBe(true);
      // The top row of a `T`, which is a solid bar however wide the terminal is.
      expect(t.text()).toContain(banner('T', fontAt('block'), PEN).split('\n')[0]);
      await t.unmount();
    });
  }

  it('changes the colour and never the characters', async () => {
    const t = await open();
    const before = block(t);
    expect(before).not.toEqual([]);

    for (const preset of PRESETS) {
      t.app.store.set(PRESET, preset.id);
      await t.settle();
      // Every ink in the list, including none at all. If an ink were reaching
      // the text rather than the colour, one of these would differ - and that
      // is the whole claim the component makes.
      expect(block(t), preset.id).toEqual(before);
      expect(t.errors()).toEqual([]);
    }
    await t.unmount();
  });

  it('draws every font, in the characters that font is made of', async () => {
    const t = await open();
    // Short, so every font fits the panel - `wide` and `stars` are twice the
    // width of the rest, and a clipped row would not be found.
    t.app.store.set(TEXT, 'AB');
    for (const font of FONTS) {
      t.app.store.set(FONT, font.id);
      await t.settle();
      expect(t.errors(), font.id).toEqual([]);
      // Every row of what this font draws, on the screen. Not "differs from
      // the last one" - `dots` and `stars` differ from `block` in the
      // characters, which a filter for block glyphs would have thrown away.
      for (const row of banner('AB', font, PEN).split('\n')) {
        if (row.trim() !== '') expect(t.text(), `${font.id}: ${row}`).toContain(row);
      }
    }
    await t.unmount();
  });

  it('follows the text it is given, over more than one line', async () => {
    const t = await open();
    t.app.store.set(TEXT, 'AB\nCD');
    await t.settle();
    const drawn = block(t).join('\n');
    // Both lines, each as its own block of rows - the second one is what a
    // single-line banner would have dropped on the floor.
    expect(drawn).toContain(banner('AB', fontAt('block'), PEN).split('\n')[2]);
    expect(drawn).toContain(banner('CD', fontAt('block'), PEN).split('\n')[2]);
    await t.unmount();
  });

  it('wraps a banner too wide for the panel rather than cutting it', async () => {
    const t = await open(SIZES[1] as { width: number; height: number });
    t.app.store.set(TEXT, 'Deployment finished');
    await t.settle();
    expect(t.errors()).toEqual([]);

    // The last word is on the screen. Truncating put the first few letters up
    // and dropped the rest, and the panel looked like the component was
    // broken rather than like the terminal was narrow.
    const drawn = block(t).join('\n');
    expect(drawn).not.toBe('');
    // More rows than one line of this font takes, which is what wrapping means
    // here: the text broke, the letters did not. The swatch is dropped first -
    // it is a solid bar of the same glyph, and leaving it in made a count of
    // six pass whether anything had wrapped or not.
    const rows = drawn.split('\n')
      .filter((line) => line.includes(FILL) && line.trim().replace(new RegExp(FILL, 'g'), '') !== '');
    expect(rows.length).toBeGreaterThan(5);
    await t.unmount();
  });

  it('scrolls the panel rather than losing what does not fit', async () => {
    // Small enough that the banner is taller than the panel, which is the
    // case a fixed-height viewport gets silently wrong.
    const t = await open(SIZES[1] as { width: number; height: number });
    t.app.store.set(TEXT, 'AB\nCD\nEF');
    await t.settle();
    const first = block(t).join('\n');

    // Taller than the panel, or there is nothing for paging to prove.
    expect(first.split('\n').length).toBeGreaterThan(0);

    t.focus('panel');
    await t.settle();
    t.press('pagedown');
    await t.settle();
    expect(t.errors()).toEqual([]);
    // Something moved, and nothing broke. Which rows arrive is the viewport's
    // business, not this test's.
    expect(block(t).join('\n')).not.toBe(first);
    await t.unmount();
  });

  it('renders prose through the same component and the same inks', async () => {
    const t = await open();
    t.app.store.set(PLAIN, true);

    for (const preset of PRESETS) {
      t.app.store.set(PRESET, preset.id);
      await t.settle();
      expect(t.errors()).toEqual([]);
      expect(t.hasText('plain text')).toBe(true);
      // Wrapped, so no assertion on a whole sentence: a word from the middle
      // of it is what says the paragraph arrived rather than the banner.
      expect(t.hasText('decoration')).toBe(true);
    }
    await t.unmount();
  });

  it('draws the banner in whatever the theme has, down to ascii', async () => {
    const t = await render({ component: 'InkFrame' }, {
      width: 96,
      height: 30,
      builtins: false,
      capabilities: { unicode: 'ascii', wideChars: false },
      onBoot: (app) => { registerInk(app); },
    });
    for (let i = 0; i < 8; i++) await t.settle();
    expect(t.errors()).toEqual([]);
    // No block glyph anywhere, and the letters are still there.
    expect(t.text()).not.toContain(FILL);
    expect(t.text()).toContain(banner('T', fontAt('block'), ASCII_PEN).split('\n')[0]);

    // `half` is the font that asks for a character the theme has no name for.
    // Here it has to be quotes and underscores, and it still has to be a `T`.
    t.app.store.set(FONT, 'half');
    t.app.store.set(TEXT, 'T');
    await t.settle();
    for (const row of banner('T', fontAt('half'), ASCII_PEN).split('\n')) {
      expect(t.text(), row).toContain(row);
    }
    expect(t.text()).not.toContain('▀');

    // `tmplt` is box-drawing, which an ascii terminal has none of, so it draws
    // its stand-in instead - the same three rows in characters a teletype has.
    t.app.store.set(FONT, 'tmplt');
    await t.settle();
    expect(t.errors()).toEqual([]);
    expect(t.text()).not.toContain('┏');
    for (const row of banner('T', fontAt('mini'), ASCII_PEN).split('\n')) {
      expect(t.text(), row).toContain(row);
    }
    await t.unmount();
  });
});
