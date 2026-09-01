import { describe, expect, it } from 'vitest';
import { Writer } from '../src/writer.js';
import type { Frame, Run } from '@textui/core';

/*
 * Taking the cursor away is work, even when nothing is repainted.
 *
 * Focus moving from a text field to a control with no caret - a select, a
 * button, a list - changes no cell that the field did not already own, so the
 * frame can arrive with no runs at all. The writer returned an empty string
 * for it, and the terminal went on showing its cursor in the field somebody
 * had just tabbed out of.
 */
describe('the cursor across frames', () => {
  const ESC = String.fromCharCode(27);
  const SHOW = `${ESC}[?25h`;
  const HIDE = `${ESC}[?25l`;

  const caps = {
    cursor: true, synchronizedOutput: false, trueColor: true,
    unicode: 'full', hyperlinks: false, mouse: false,
  } as never;

  const run = (text: string): Run =>
    ({ x: 0, y: 0, text, fg: -1, bg: -1, attrs: 0, link: undefined }) as unknown as Run;

  const frame = (runs: Run[], cursor: Frame['cursor']): Frame =>
    ({ runs, cursor, full: false }) as Frame;

  /** A writer that has already put a visible cursor on screen. */
  const withCursor = (): Writer => {
    const writer = new Writer(caps);
    const first = writer.write(frame([run('a')], { x: 3, y: 0, visible: true }));
    expect(first).toContain(SHOW);
    return writer;
  };

  it('takes it away when the next frame paints nothing', () => {
    const writer = withCursor();
    // The regression: this was '' and the caret stayed where it was.
    expect(writer.write(frame([], null))).toContain(HIDE);
  });

  it('takes it away when the next frame does paint', () => {
    const writer = withCursor();
    expect(writer.write(frame([run('b')], null))).toContain(HIDE);
  });

  it('says nothing at all when there was none to begin with', () => {
    const writer = new Writer(caps);
    // Still the cheap path: no paint, no caret, nothing on screen to undo.
    expect(writer.write(frame([], null))).toBe('');
  });

  it('does not hide one it is about to put back', () => {
    const writer = withCursor();
    const out = writer.write(frame([run('b')], { x: 5, y: 0, visible: true }));
    // Hidden for the paint and shown again after it, which is what stops a
    // caret streaking across the row.
    expect(out.lastIndexOf(SHOW)).toBeGreaterThan(out.lastIndexOf(HIDE));
  });

  it('does not keep hiding a cursor that is already gone', () => {
    const writer = withCursor();
    expect(writer.write(frame([], null))).toContain(HIDE);
    expect(writer.write(frame([], null))).toBe('');
  });
});
