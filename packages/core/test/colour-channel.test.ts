import { describe, expect, it } from 'vitest';
import type { BorderSpec, BgColor, FgColor, Style } from '../src/types/style.js';

/**
 * A colour is typed by the channel it is used in.
 *
 * The runtime cannot enforce this - a token and a literal are both strings by
 * the time a frame is painted - so the type is the whole of the guarantee and
 * these cases are what it is worth. Each `@ts-expect-error` fails the build if
 * the mistake it names starts compiling, which is the only way a narrowing
 * that only ever removes errors can be seen to work.
 *
 * That these are compile errors at all is the other half: the positive cases
 * below use the same tokens and the literal escape, so the list is a boundary
 * rather than a prohibition.
 */

/** A style is a plain object, so a mistake in it is a mistake at the call site. */
const style = (value: Style): Style => value;

describe('a foreground', () => {
  it('takes the text roles and a literal', () => {
    const literal: FgColor = '#ff8800';
    const named: FgColor = 'muted';
    expect(style({ fg: 'text' }).fg).toBe('text');
    expect(style({ fg: named }).fg).toBe('muted');
    expect(style({ fg: literal }).fg).toBe('#ff8800');
    expect(style({ fg: 'red' }).fg).toBe('red');
    expect(style({ fg: { rgb: [255, 136, 0] } }).fg).toEqual({ rgb: [255, 136, 0] });
  });

  it('takes a state, because a disabled label is still a label', () => {
    expect(style({ fg: 'disabled' }).fg).toBe('disabled');
    expect(style({ fg: 'focus' }).fg).toBe('focus');
  });

  it('takes what is written on a fill, which is its whole purpose', () => {
    expect(style({ fg: 'onSelected' }).fg).toBe('onSelected');
    expect(style({ fg: 'onAccent' }).fg).toBe('onAccent');
  });

  it('refuses a page colour, which is a fill and not a writing', () => {
    // @ts-expect-error `canvas` is a background token.
    style({ fg: 'canvas' });
    // @ts-expect-error and so is `surface`.
    style({ fg: 'surface' });
  });
});

describe('a background', () => {
  it('takes the page colours and a literal', () => {
    const literal: BgColor = '#123456';
    expect(style({ bg: 'canvas' }).bg).toBe('canvas');
    expect(style({ bg: literal }).bg).toBe('#123456');
  });

  it('takes a state, which is what a selected row is filled with', () => {
    expect(style({ bg: 'selected' }).bg).toBe('selected');
    expect(style({ bg: 'active' }).bg).toBe('active');
  });

  it('refuses the colour written on a fill, which is the mistake the pair exists to stop', () => {
    // @ts-expect-error `onSelected` is a foreground token.
    style({ bg: 'onSelected' });
    // @ts-expect-error and so is `onAccent`.
    style({ bg: 'onAccent' });
  });
});

describe('a border', () => {
  /** A frame, not the shorthand a bare style name is. */
  const rule = (spec: Exclude<BorderSpec, string>): Exclude<BorderSpec, string> => spec;

  it('takes the rule roles and a literal', () => {
    expect(rule({ style: 'single', color: 'borderStrong' }).color).toBe('borderStrong');
    expect(rule({ style: 'single', color: '#ff8800' }).color).toBe('#ff8800');
  });

  it('takes the quiet foregrounds, because a dim rule is a line somebody means', () => {
    expect(rule({ style: 'single', color: 'muted' }).color).toBe('muted');
    expect(rule({ style: 'single', color: 'subtle' }).color).toBe('subtle');
    expect(rule({ style: 'single', colors: { left: 'muted' } }).colors?.left).toBe('muted');
  });

  it('takes a per-edge colour', () => {
    const spec: BorderSpec = {
      style: 'single',
      colors: { top: 'borderSubtle', bottom: 'danger' },
    };
    expect(spec.style).toBe('single');
  });

  it('refuses a text colour, which is the one pairing that never reads as a rule', () => {
    // @ts-expect-error `text` is a foreground token.
    rule({ style: 'single', color: 'text' });
    // @ts-expect-error including on one edge.
    rule({ style: 'single', colors: { left: 'text' } });
  });

  it('refuses a page colour, which has no edge to be seen against', () => {
    // @ts-expect-error `canvas` is a background token.
    rule({ style: 'single', color: 'canvas' });
  });
});

describe('a scrim', () => {
  it('is a fill, so it takes a background token', () => {
    expect(style({ scrim: true }).scrim).toBe(true);
    expect(style({ scrim: 'shadow' }).scrim).toBe('shadow');
  });

  it('refuses a foreground token', () => {
    // @ts-expect-error `text` is a foreground token.
    style({ scrim: 'text' });
  });
});
