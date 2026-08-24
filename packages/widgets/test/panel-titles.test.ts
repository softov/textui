import { describe, expect, it } from 'vitest';
import { h, renderToString } from '@textui/core';
import { Panel } from '../src/layout/index.js';
import { CATALOG } from '../src/index.js';

/*
 * A panel can carry a short label beside its heading - a count, a state, the
 * shortcut that opens it - and it goes on the top rule, hard against the right.
 *
 * `meta` was documented as exactly that and did something else: on a bordered
 * panel it went into the *bottom* rule, and only on a borderless one did it sit
 * beside the title. One prop, two places, depending on another prop.
 */
describe('a panel with a label beside its title', () => {
  const draw = (props: Record<string, unknown>, width: number): string[] =>
    renderToString(h(Panel, props, h('text', { content: 'body' })), { width, components: CATALOG })
      .split('\n').map((line) => line.trimEnd()).filter((line) => line !== '');

  // Two widths, because the whole question is what happens when the two
  // labels want more room than the rule has.
  for (const width of [40, 24]) {
    it(`puts it on the top rule at ${width} columns`, () => {
      const [top] = draw({ title: 'Controls', rightTitle: '3 items' }, width);
      expect(top).toContain('Controls');
      expect(top).toContain('3 items');
      // Hard against the right: the last cell is the corner, and the label is
      // the thing before it.
      expect(top?.trimEnd().endsWith('3 items ┐')).toBe(true);
    });
  }

  it('truncates the title rather than the label', () => {
    // The right label takes its width first. It is the short one - a count or
    // a state - and a half-written count says nothing, where a truncated
    // heading still reads.
    const [top] = draw({ title: 'A very long panel heading indeed', rightTitle: '12' }, 24);
    expect(top).toContain('12 ┐');
    expect(top).toContain('…');
    expect(top).not.toContain('heading indeed');
  });

  it('never lets the two labels land on the same cells', () => {
    // The failure this is guarding is one drawn over the other, which reads as
    // a corrupted frame rather than as a layout mistake.
    for (const width of [40, 24, 16]) {
      const [top = ''] = draw({ title: 'Wide enough heading', rightTitle: 'state' }, width);
      expect(top.length).toBe(width);
      // One '…' at most: two would mean both were truncated into each other.
      expect((top.match(/…/g) ?? []).length).toBeLessThanOrEqual(1);
    }
  });

  it('stands alone, with no title beside it', () => {
    const [top = ''] = draw({ rightTitle: 'ctrl+p' }, 30);
    expect(top).toContain('ctrl+p ┐');
  });

  it('is a different place from meta, which is the bottom rule', () => {
    const rows = draw({ title: 'Both', rightTitle: 'live', meta: 'f1 help' }, 34);
    expect(rows[0]).toContain('live');
    expect(rows[0]).not.toContain('f1 help');
    expect(rows[rows.length - 1]).toContain('f1 help');
  });

  it('shares the heading row when there is no border to write on', () => {
    const rows = draw({ title: 'Airy', rightTitle: '7', border: 'none' }, 30);
    expect(rows[0]).toContain('Airy');
    expect(rows[0]?.trimEnd().endsWith('7')).toBe(true);
  });
});
