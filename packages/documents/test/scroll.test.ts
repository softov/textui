import { describe, expect, it } from 'vitest';
import { horizontalWindow } from '../src/index.js';

/**
 * Where the horizontal window sits.
 *
 * The property that matters is that the rule is a **fixed point**: feeding its
 * own answer back in has to give the same answer. When it did not, the caret at
 * the end of the longest line oscillated one column wide, forever - the branch
 * that scrolls it into view asked for `caretColumn - textWidth + 1`, the clamp
 * allowed only `longest - textWidth`, and every frame undid the last one. On
 * screen that is a flicker; here it is two expressions disagreeing about
 * whether the caret is part of the line.
 *
 * A single-frame assertion cannot see it, which is why this tests the rule
 * rather than the renderer: a settle loop that runs an even number of times
 * lands on the same phase and reports a view that has settled.
 */

const settled = (o: Parameters<typeof horizontalWindow>[0]): boolean =>
  horizontalWindow({ ...o, left: horizontalWindow(o) }) === horizontalWindow(o);

describe('the horizontal window', () => {
  it('is a fixed point wherever the caret is', () => {
    const textWidth = 40;
    for (const longest of [0, 1, 39, 40, 41, 73, 200]) {
      for (let caretColumn = 0; caretColumn <= longest; caretColumn++) {
        for (const left of [0, 1, Math.max(0, longest - textWidth), longest]) {
          const at = { caretColumn, left, textWidth, longest };
          expect(settled(at), `oscillates at ${JSON.stringify(at)}`).toBe(true);
        }
      }
    }
  });

  it('keeps the caret at the end of the longest line in view, and stays there', () => {
    // The case that flickered: caret one past the last character of the line
    // that decides the clamp.
    const at = { caretColumn: 73, left: 33, textWidth: 40, longest: 73 };
    const once = horizontalWindow(at);
    expect(once).toBe(34);
    expect(horizontalWindow({ ...at, left: once }), 'and it does not bounce back').toBe(34);
  });

  it('does not scroll a line that fits', () => {
    expect(horizontalWindow({ caretColumn: 5, left: 0, textWidth: 40, longest: 5 })).toBe(0);
    expect(horizontalWindow({ caretColumn: 40, left: 0, textWidth: 40, longest: 40 })).toBe(1);
  });

  it('follows the caret back to the left edge', () => {
    expect(horizontalWindow({ caretColumn: 0, left: 33, textWidth: 40, longest: 73 })).toBe(0);
  });

  it('never scrolls past the end, however far right the caret was', () => {
    const longest = 73, textWidth = 40;
    const max = longest + 1 - textWidth;
    for (let caretColumn = 0; caretColumn <= longest; caretColumn++) {
      expect(horizontalWindow({ caretColumn, left: 0, textWidth, longest }))
        .toBeLessThanOrEqual(max);
    }
  });
});
