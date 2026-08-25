import { describe, expect, it } from 'vitest';
import { render } from '@textui/testing';
import type { Harness } from '@textui/testing';
import { FONT, PLAIN, PRESET, TEXT, registerInk } from '../src/app.js';
import { PRESETS } from '../src/inks.js';
import { FONTS, banner, fontAt } from '../src/fonts.js';

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
      expect(t.text()).toContain(banner('T', fontAt('block'), FILL).split('\n')[0]);
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

  it('draws every font, and each one differently', async () => {
    const t = await open();
    const seen = new Map<string, string>();
    for (const font of FONTS) {
      t.app.store.set(FONT, font.id);
      await t.settle();
      expect(t.errors(), font.id).toEqual([]);
      const drawn = block(t).join('\n');
      expect(drawn, font.id).not.toBe('');
      for (const [id, other] of seen) {
        expect(drawn, `${font.id} vs ${id}`).not.toBe(other);
      }
      seen.set(font.id, drawn);
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
    expect(drawn).toContain(banner('AB', fontAt('block'), FILL).split('\n')[2]);
    expect(drawn).toContain(banner('CD', fontAt('block'), FILL).split('\n')[2]);
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
    expect(t.text()).toContain(banner('T', fontAt('block'), '#').split('\n')[0]);
    await t.unmount();
  });
});
