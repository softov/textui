import { describe, expect, it } from 'vitest';
import { createBuffer, MINIMAL_CAPABILITIES } from '@textui/core';
import type { TerminalCapabilities } from '@textui/core';
import { captureBuffer } from '../src/capture.js';

/**
 * A frame you can keep.
 *
 * The writer emits the difference between two frames, with cursor moves - the
 * right thing on a live terminal and unreadable in a file. A capture is the
 * whole frame, in order, so a bug report can carry the screen rather than a
 * description of it.
 */
const CAPABLE: TerminalCapabilities = { ...MINIMAL_CAPABILITIES, colorDepth: 24 };

function filled(): ReturnType<typeof createBuffer> {
  const buffer = createBuffer(8, 3);
  const put = (x: number, y: number, char: string, style: Record<string, unknown> = {}) => {
    buffer.set(x, y, { char, fg: 'default', bg: 'default', attrs: 0, ...style });
  };
  for (const [i, char] of [...'hi'].entries()) put(i, 0, char, { fg: { rgb: [200, 30, 30] } });
  for (const [i, char] of [...'there'].entries()) put(i, 1, char);
  return buffer;
}

describe('capturing a frame', () => {
  it('is the whole frame, one row per line, with no cursor control', () => {
    const text = captureBuffer(filled(), CAPABLE, { colors: false });

    expect(text.split('\n')).toEqual(['hi', 'there', '']);
    // Nothing that moves a cursor, which is what makes it a file rather than
    // a recording of one terminal session.
    expect(text).not.toContain('\x1b[');
  });

  it('carries the colour when it is asked to', () => {
    const text = captureBuffer(filled(), CAPABLE);

    expect(text).toContain('\x1b[38;2;');
    expect(text).toContain('hi');
    // And puts the terminal back, so the colour does not run to the edge of
    // whatever shows the file.
    // eslint-disable-next-line no-control-regex
    expect(text.split('\n')[0]).toMatch(/\x1b\[(0|39)m$/);
  });

  it('says nothing about colour on a terminal that has none', () => {
    const text = captureBuffer(filled(), MINIMAL_CAPABILITIES);

    expect(text).not.toContain('\x1b');
  });

  it('keeps a painted background but drops trailing blanks', () => {
    const buffer = createBuffer(6, 1);
    buffer.set(0, 0, { char: 'x', fg: 'default', bg: 'default', attrs: 0 });
    buffer.set(1, 0, { char: ' ', fg: 'default', bg: 'blue', attrs: 0 });

    const plain = captureBuffer(buffer, CAPABLE, { colors: false });
    // A blank with a background is a part of the picture; a blank without one
    // is where the row ended.
    expect(plain).toBe('x ');
  });

  it('reduces colour to the depth the terminal reports', () => {
    const buffer = createBuffer(1, 1);
    buffer.set(0, 0, { char: 'x', fg: { rgb: [200, 30, 30] }, bg: 'default', attrs: 0 });

    const deep = captureBuffer(buffer, CAPABLE);
    const shallow = captureBuffer(buffer, { ...MINIMAL_CAPABILITIES, colorDepth: 4 });

    expect(deep).toContain('38;2;200;30;30');
    expect(shallow).not.toContain('38;2;');
    expect(shallow).toContain('\x1b[');
  });
});
