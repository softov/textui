import { describe, expect, it } from 'vitest';
import { contentBox, key, parse, serialise, totalMs, unkey, usedColors } from '../src/motion.js';
import type { MotionDocument } from '../src/motion.js';
import { SAMPLE } from '../src/sample.js';

/**
 * The format, not the rendering.
 *
 * Everything here is a property of the document that a player has to get right
 * before anything is drawn: which way round the key is, that a hold is not a
 * frame rate, and that saving gives back what was opened. What a frame *looks*
 * like is a judgement no assertion makes; the smoke test renders one.
 */

const doc = (): MotionDocument => JSON.parse(JSON.stringify(SAMPLE)) as MotionDocument;

describe('cell keys', () => {
  it('reads column first, then row', () => {
    // The trap: "14,41" on an 80x45 canvas is column 14 of row 41, and read
    // the other way it is still in range - so a transposed reader does not
    // crash, it silently draws the picture on its side.
    expect(unkey('14,41')).toEqual({ x: 14, y: 41 });
    expect(key(14, 41)).toBe('14,41');
  });

  it('round-trips coordinates past ten', () => {
    for (const [x, y] of [[0, 0], [7, 3], [14, 41], [79, 44]] as const) {
      expect(unkey(key(x, y))).toEqual({ x, y });
    }
  });
});

describe('parsing', () => {
  it('reads the canvas, the ground and every frame', () => {
    const movie = parse(doc());
    expect(movie.width).toBe(80);
    expect(movie.height).toBe(45);
    expect(movie.ground).toBe('#8c916e');
    expect(movie.frames).toHaveLength(3);
    expect(movie.frames.every((f) => f.cells.size > 0)).toBe(true);
  });

  it('keeps each frame on its own hold rather than a shared rate', () => {
    const movie = parse(doc());
    const holds = movie.frames.map((f) => f.duration);
    expect(holds).toEqual([700, 120, 67]);
    // The point of the format: the longest hold is more than ten times the
    // shortest, so any single frame rate is wrong for most of the timeline.
    expect(Math.max(...holds) / Math.min(...holds)).toBeGreaterThan(10);
    expect(totalMs(movie)).toBe(887);
  });

  it('refuses a document with no frames array', () => {
    expect(() => parse({ canvas_data: {} } as MotionDocument)).toThrow(/animation\.frames/);
  });
});

describe('content box', () => {
  it('finds the drawing inside a mostly empty canvas', () => {
    const movie = parse(doc());
    const box = contentBox(movie);
    expect(box).toEqual({ x: 11, y: 39, width: 42, height: 6 });
    // Which is the reason it exists: 42x6 of an 80x45 sheet.
    expect(box.width * box.height).toBeLessThan(movie.width * movie.height / 10);
  });

  it('ignores a painted space, which is in the data but prints nothing', () => {
    const movie = parse(doc());
    const frame = movie.frames[0]!;
    const before = contentBox(movie);
    frame.cells.set(key(0, 0), { char: ' ', color: '#1d1f2f' });
    expect(contentBox(movie)).toEqual(before);
    // The same cell with a glyph in it does move the box.
    frame.cells.set(key(0, 0), { char: '@', color: '#1d1f2f' });
    expect(contentBox(movie).x).toBe(0);
  });
});

describe('used colours', () => {
  it('counts only the cells that print, most used first', () => {
    const movie = parse(doc());
    const used = usedColors(movie);
    expect(used).toHaveLength(1);
    expect(used[0]?.color).toBe('#1d1f2f');
    expect(used[0]?.count).toBeGreaterThan(150);
  });
});

describe('saving', () => {
  it('gives back every cell it was given', () => {
    const original = doc();
    const text = serialise(parse(doc()));
    const back = JSON.parse(text) as MotionDocument;

    const a = original.canvas_data?.animation?.frames ?? [];
    const b = back.canvas_data?.animation?.frames ?? [];
    expect(b).toHaveLength(a.length);
    a.forEach((frame, i) => {
      expect(b[i]?.id).toBe(frame.id);
      expect(b[i]?.name).toBe(frame.name);
      expect(b[i]?.duration).toBe(frame.duration);
      expect(Object.keys(b[i]?.data ?? {}).sort()).toEqual(Object.keys(frame.data ?? {}).sort());
      for (const [k, cell] of Object.entries(frame.data ?? {})) {
        expect(b[i]?.data?.[k]).toEqual(cell);
      }
    });
  });

  it('keeps fields the editor never looked at', () => {
    const original = doc();
    (original as Record<string, unknown>).user_id = 'bbdfef75';
    original.canvas_data!.palettes = { recentColors: ['#1d1f2f'], activePaletteId: 'ansi-16' };
    const back = JSON.parse(serialise(parse(original))) as MotionDocument;
    expect((back as Record<string, unknown>).user_id).toBe('bbdfef75');
    expect(back.canvas_data?.palettes).toEqual({ recentColors: ['#1d1f2f'], activePaletteId: 'ansi-16' });
  });

  it('writes an edited cell through', () => {
    const movie = parse(doc());
    movie.frames[1]!.cells.set(key(3, 4), { char: 'Z', color: '#ff0000' });
    const back = JSON.parse(serialise(movie)) as MotionDocument;
    expect(back.canvas_data?.animation?.frames?.[1]?.data?.['3,4'])
      .toEqual({ char: 'Z', color: '#ff0000', bgColor: 'transparent' });
  });
});
