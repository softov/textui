import { describe, expect, it } from 'vitest';
import { h, renderToString } from '@textui/core';
import { TextArea } from '../src/control/index.js';
import { CATALOG } from '../src/index.js';

// `height: rows` sat on the outer box, so the rows and the border shared one
// allowance and the border spent it: a bordered TextArea drew its top edge and
// nothing else. Invisible in every existing use, because a field with no
// border looks identical either way.
describe('a bordered TextArea', () => {
  const field = (value: string, extra: Record<string, unknown> = {}) =>
    h(TextArea, { value, onChange: () => undefined, placeholder: 'say something', ...extra });

  for (const width of [28, 60]) {
    it(`draws all four edges and its content at ${width} columns`, () => {
      const lines = renderToString(field('', { border: 'single' }), { width, components: CATALOG })
        .split('\n').filter((l) => l.trim() !== '');

      expect(lines).toHaveLength(3);
      expect(lines[0]).toContain('┌');
      expect(lines[1]).toContain('say something');
      expect(lines[2]).toContain('└');
    });
  }

  it('grows a row per line inside the border', () => {
    const lines = renderToString(field('a\nb\nc', { border: 'single' }), { width: 28, components: CATALOG })
      .split('\n').filter((l) => l.trim() !== '');
    expect(lines).toHaveLength(5);
    for (const [i, letter] of ['a', 'b', 'c'].entries()) expect(lines[i + 1]).toContain(letter);
  });

  it('stops growing at maxRows', () => {
    const lines = renderToString(field('1\n2\n3\n4\n5\n6', { border: 'single', maxRows: 3 }), { width: 28, components: CATALOG })
      .split('\n').filter((l) => l.trim() !== '');
    expect(lines).toHaveLength(5);
  });

  it('is unchanged without a border', () => {
    expect(renderToString(field(''), { width: 28, components: CATALOG }).trimEnd()).toBe('say something');
  });
});
