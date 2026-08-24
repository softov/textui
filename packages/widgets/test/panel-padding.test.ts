import { describe, expect, it } from 'vitest';
import { h, renderToString } from '@textui/core';
import { Panel } from '../src/layout/index.js';
import { CATALOG } from '../src/index.js';

/*
 * Padding is about the body, and a subtitle is not the body.
 *
 * It used to be one box - border, then subtitle and children together inside
 * whatever padding was asked for - so `padding={1}` put a blank row between a
 * title and its own caption, and left the caption sitting directly on the
 * content it is not part of. Read top to bottom, the subtitle became the first
 * line of the body.
 */
describe('a padded panel with a subtitle', () => {
  const draw = (props: Record<string, unknown>, width = 38): string[] =>
    renderToString(
      h(Panel, { title: 'Controls', ...props },
        h('text', { content: 'first' }),
        h('text', { content: 'second' })),
      { width, components: CATALOG },
    ).split('\n').map((line) => line.trimEnd());

  /** A row with nothing on it - which inside a border still has two edges. */
  const blank = (line = ''): boolean => line.replace(/[│\s]/g, '') === '';

  for (const width of [38, 26]) {
    it(`keeps the subtitle against the title at ${width} columns`, () => {
      const rows = draw({ subtitle: 'a caption', padding: 1 }, width);
      // Row 0 is the top rule; the caption is the row under it, not two below.
      expect(rows[1]).toContain('a caption');
      // And indented with the body, because a caption lining up with neither
      // the frame nor the content reads as a mistake.
      expect(rows[1]?.indexOf('a caption')).toBe(rows[3]?.indexOf('first'));
    });
  }

  it('puts the vertical padding around the body, not the header', () => {
    const rows = draw({ subtitle: 'a caption', padding: 1 });
    expect(rows[1]).toContain('a caption');
    expect(blank(rows[2])).toBe(true);
    expect(rows[3]).toContain('first');
    expect(rows[4]).toContain('second');
    expect(blank(rows[5])).toBe(true);
  });

  it('does not push the title down on a borderless panel', () => {
    // There is no rule to hold the title, so it is a row - and the top padding
    // used to land above it.
    const rows = draw({ subtitle: 'a caption', padding: 1, border: 'none' });
    expect(rows[0]).toContain('Controls');
    expect(rows[1]).toContain('a caption');
    expect(blank(rows[2])).toBe(true);
    expect(rows[3]).toContain('first');
  });

  it('leaves a panel with no subtitle exactly as it was', () => {
    // The split only happens when there is a caption to protect. Without one
    // the padding is the caller's plain padding and nothing is wrapped.
    const rows = draw({ padding: 1 });
    expect(blank(rows[1])).toBe(true);
    expect(rows[2]).toContain('first');
    expect(rows[3]).toContain('second');
    expect(blank(rows[4])).toBe(true);
  });

  it('leaves horizontal-only padding alone', () => {
    // Nothing vertical to move, so nothing to split and no extra box.
    const rows = draw({ subtitle: 'a caption', padding: [0, 1] });
    expect(rows[1]).toContain('a caption');
    expect(rows[2]).toContain('first');
    expect(rows[1]?.indexOf('a caption')).toBe(2);
  });
});
