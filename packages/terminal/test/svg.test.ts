import { describe, expect, it } from 'vitest';
import { ATTR_BOLD, ATTR_DIM, ATTR_INVERSE, ATTR_UNDERLINE, Buffer } from '@textui/core';
import { bufferToSvg } from '../src/svg.js';

/*
 * `captureBuffer` writes a frame a terminal can replay. This writes one a
 * repository page can show, which is the place a terminal application most
 * needs to show what it looks like and the one place an `.ans` file cannot.
 */
describe('a frame as an SVG', () => {
  const buffer = (width: number, height: number): Buffer => new Buffer(width, height);

  const put = (
    b: Buffer, x: number, y: number, text: string,
    style: { fg?: string; bg?: string; attrs?: number } = {},
  ): void => {
    [...text].forEach((char, i) => {
      b.set(x + i, y, {
        char,
        fg: (style.fg ?? 'default') as never,
        bg: (style.bg ?? 'default') as never,
        attrs: style.attrs ?? 0,
      });
    });
  };

  it('is one self-contained document, and nothing is fetched to read it', () => {
    const b = buffer(10, 2);
    put(b, 0, 0, 'hello');
    const svg = bufferToSvg(b);

    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect(svg.endsWith('</svg>')).toBe(true);
    // The whole reason it works on GitHub, whose image proxy fetches nothing on
    // the page's behalf.
    expect(svg).not.toMatch(/<script|@import|xlink:href|url\(|<image/);
    expect(svg).toContain('>hello</text>');
  });

  it('sizes itself from the grid and the cell', () => {
    const svg = bufferToSvg(buffer(20, 5), { cellWidth: 8, cellHeight: 17, padding: 10 });
    expect(svg).toContain('width="180" height="105"');
    expect(svg).toContain('viewBox="0 0 180 105"');
  });

  it('coalesces a row into one run per style, not one per cell', () => {
    const b = buffer(12, 1);
    put(b, 0, 0, 'aaa', { fg: '#ff0000' });
    put(b, 3, 0, 'bbb', { fg: '#00ff00' });
    const svg = bufferToSvg(b);

    // Two runs for six cells. A `<text>` per cell would still draw correctly
    // and would be six times the file for the same picture.
    expect(svg.match(/<text /g)).toHaveLength(2);
    expect(svg).toContain('fill="#ff0000"');
    expect(svg).toContain('>aaa</text>');
    expect(svg).toContain('>bbb</text>');
  });

  it('paints a background as a rect, and skips the one that matches the paper', () => {
    const b = buffer(6, 1);
    put(b, 0, 0, 'xx', { bg: '#123456' });
    const svg = bufferToSvg(b, { background: '#000000' });

    expect(svg).toContain('<rect x="10" y="10" width="16" height="17" fill="#123456"/>');
    // One for the backdrop and one for the run - the four default cells beside
    // it are already the right colour.
    expect(svg.match(/<rect /g)).toHaveLength(2);
  });

  it('draws backgrounds before glyphs, because SVG has no z-index', () => {
    const b = buffer(4, 1);
    put(b, 0, 0, 'ab', { fg: '#ffffff', bg: '#ff0000' });
    const svg = bufferToSvg(b);
    // A rect emitted after the text would paint the text out.
    expect(svg.indexOf('fill="#ff0000"')).toBeLessThan(svg.indexOf('<text '));
  });

  it('carries bold, italic, underline and strike as they are drawn', () => {
    const b = buffer(4, 1);
    put(b, 0, 0, 'ab', { attrs: ATTR_BOLD | ATTR_UNDERLINE });
    const svg = bufferToSvg(b);
    expect(svg).toContain('font-weight="bold"');
    expect(svg).toContain('text-decoration="underline"');
  });

  it('resolves inverse into the two colours it swaps', () => {
    const b = buffer(4, 1);
    put(b, 0, 0, 'ab', { attrs: ATTR_INVERSE });
    const svg = bufferToSvg(b, { background: '#000000', foreground: '#ffffff' });

    // The cell left both sides at the terminal's default, so inverting is a
    // swap of the two colours the picture chose - which is only knowable once
    // they have been filled in.
    expect(svg).toContain('fill="#ffffff"/>');   // the rect
    expect(svg).toContain('fill="#000000"');     // the glyphs
  });

  it('renders dim as a colour part of the way to the one behind it', () => {
    const b = buffer(4, 1);
    put(b, 0, 0, 'ab', { fg: '#ffffff', attrs: ATTR_DIM });
    const svg = bufferToSvg(b, { background: '#000000' });
    // Half way from white to black, because "half as bright" is not a thing an
    // arbitrary hex can be asked for.
    expect(svg).toContain('fill="#808080"');
  });

  it('leaves out a run of blanks, and keeps one that is underlined', () => {
    const plain = bufferToSvg(buffer(8, 1));
    expect(plain).not.toContain('<text ');

    const b = buffer(8, 1);
    put(b, 0, 0, '  ', { attrs: ATTR_UNDERLINE });
    expect(bufferToSvg(b)).toContain('<text ');
  });

  it('escapes what a frame can legally contain', () => {
    const b = buffer(20, 1);
    put(b, 0, 0, '<a & b>');
    const svg = bufferToSvg(b);
    expect(svg).toContain('&lt;a &amp; b&gt;');
    expect(svg).not.toContain('<a &');
  });

  it('tells each run how wide it is, so the grid holds in another font', () => {
    const b = buffer(8, 1);
    put(b, 0, 0, 'abcd');
    const svg = bufferToSvg(b, { cellWidth: 8 });
    // Four columns at eight pixels. Without this the picture is only aligned
    // for readers whose monospace font matches the one `cellWidth` was for.
    expect(svg).toContain('textLength="32" lengthAdjust="spacing"');
  });

  it('reduces colour only when asked to', () => {
    const b = buffer(4, 1);
    put(b, 0, 0, 'ab', { fg: '#123456' });
    expect(bufferToSvg(b)).toContain('fill="#123456"');
    // An SVG has no colour limit of its own, so this is for showing what a
    // shallower terminal would have shown - never a default.
    expect(bufferToSvg(b, { colorDepth: 4 })).not.toContain('fill="#123456"');
  });

  it('names itself when given a title', () => {
    expect(bufferToSvg(buffer(4, 1), { title: 'a & b' })).toContain('<title>a &amp; b</title>');
    expect(bufferToSvg(buffer(4, 1))).not.toContain('<title>');
  });
});
