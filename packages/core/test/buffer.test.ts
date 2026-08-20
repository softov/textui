import { describe, expect, it } from 'vitest';
import { createBuffer, FLAG_CONTINUATION } from '../src/render/buffer.js';
import { diffFrame } from '../src/render/diff.js';
import { COLOR_DEFAULT, downsample, packColor, packRgb, toHex } from '../src/render/color.js';

describe('colour packing', () => {
  it('packs hex, short hex and rgb alike', () => {
    expect(packColor('#ff8800')).toBe(packRgb(255, 136, 0));
    expect(packColor('#f80')).toBe(packRgb(255, 136, 0));
    expect(packColor({ rgb: [255, 136, 0] })).toBe(packRgb(255, 136, 0));
  });

  it('maps the ansi names to their indices', () => {
    expect(packColor('red')).toBe(1);
    expect(packColor('brightWhite')).toBe(15);
  });

  it('treats default as default', () => {
    expect(packColor('default')).toBe(COLOR_DEFAULT);
    expect(packColor(undefined)).toBe(COLOR_DEFAULT);
  });

  it('round-trips through hex', () => {
    expect(toHex(packRgb(18, 52, 86))).toBe('#123456');
  });
});

describe('capability downsampling', () => {
  const orange = packColor('#ff8800');

  it('keeps truecolor at depth 24', () => {
    expect(downsample(orange, 24)).toBe(orange);
  });

  it('reduces to the 256 palette at depth 8', () => {
    const c = downsample(orange, 8);
    expect(c).toBeGreaterThanOrEqual(0);
    expect(c).toBeLessThan(256);
  });

  it('reduces to the 16 ansi colours at depth 4', () => {
    const c = downsample(orange, 4);
    expect(c).toBeGreaterThanOrEqual(0);
    expect(c).toBeLessThan(16);
  });

  it('drops colour entirely at depth 0', () => {
    expect(downsample(orange, 0)).toBe(COLOR_DEFAULT);
  });

  it('picks a near grey from the greyscale ramp', () => {
    const grey = downsample(packRgb(128, 128, 130), 8);
    expect(grey).toBeGreaterThanOrEqual(232);
  });
});

describe('buffer writes', () => {
  it('writes a grapheme and reads it back as text', () => {
    const b = createBuffer(6, 2);
    b.put(0, 0, 'a');
    b.put(1, 0, 'b');
    expect(b.toText()).toBe('ab\n');
  });

  it('gives a wide grapheme two cells', () => {
    const b = createBuffer(6, 1);
    b.put(0, 0, '日');
    expect(b.chars[0]).toBe('日');
    expect(b.flags[1]! & FLAG_CONTINUATION).toBe(FLAG_CONTINUATION);
    expect(b.toText()).toBe('日');
  });

  it('clears the other half when a wide pair is overwritten', () => {
    const b = createBuffer(6, 1);
    b.put(0, 0, '日');
    b.put(1, 0, 'x');
    expect(b.chars[0]).toBe(' ');
    expect(b.chars[1]).toBe('x');
    expect(b.toText()).toBe(' x');
  });

  it('clears the continuation when the left half is replaced', () => {
    const b = createBuffer(6, 1);
    b.put(0, 0, '日');
    b.put(0, 0, 'x');
    expect(b.chars[1]).toBe(' ');
    expect(b.flags[1]).toBe(0);
  });

  it('refuses to split a wide grapheme across the right edge', () => {
    const b = createBuffer(2, 1);
    b.put(1, 0, '日');
    expect(b.chars[1]).toBe(' ');
  });

  it('ignores writes outside its bounds', () => {
    const b = createBuffer(2, 1);
    expect(() => b.put(9, 9, 'x')).not.toThrow();
    expect(b.toText()).toBe('');
  });

  it('preserves content across a resize that grows', () => {
    const b = createBuffer(3, 1);
    b.put(0, 0, 'a');
    b.resize(6, 2);
    expect(b.chars[0]).toBe('a');
    expect(b.width).toBe(6);
    expect(b.height).toBe(2);
  });
});

describe('frame diff', () => {
  it('emits everything on the first frame', () => {
    const b = createBuffer(4, 2);
    b.put(0, 0, 'a');
    const frame = diffFrame(b);
    expect(frame.full).toBe(true);
    expect(frame.runs.length).toBeGreaterThan(0);
  });

  it('emits nothing when nothing changed', () => {
    const b = createBuffer(4, 2);
    b.put(0, 0, 'a');
    b.commit();
    expect(diffFrame(b).runs).toEqual([]);
  });

  it('emits only the row that changed', () => {
    const b = createBuffer(6, 3);
    b.commit();
    b.put(2, 1, 'z');
    const frame = diffFrame(b);
    expect(frame.runs).toHaveLength(1);
    expect(frame.runs[0]!.y).toBe(1);
    expect(frame.runs[0]!.x).toBe(2);
    expect(frame.runs[0]!.text).toBe('z');
  });

  it('merges adjacent same-style cells into one run', () => {
    const b = createBuffer(10, 1);
    b.commit();
    for (const [i, ch] of [...'hello'].entries()) b.put(i, 0, ch);
    const frame = diffFrame(b);
    expect(frame.runs).toHaveLength(1);
    expect(frame.runs[0]!.text).toBe('hello');
  });

  it('breaks a run when the style changes', () => {
    const b = createBuffer(10, 1);
    b.commit();
    b.put(0, 0, 'a', packColor('red'));
    b.put(1, 0, 'b', packColor('blue'));
    expect(diffFrame(b).runs).toHaveLength(2);
  });

  it('paints through a short unchanged gap rather than moving the cursor', () => {
    const b = createBuffer(12, 1);
    for (let i = 0; i < 12; i++) b.put(i, 0, '.');
    b.commit();
    b.put(0, 0, 'a');
    b.put(3, 0, 'b');
    const frame = diffFrame(b, null, 4);
    expect(frame.runs).toHaveLength(1);
    expect(frame.runs[0]!.text).toBe('a..b');
  });

  it('splits across a long unchanged gap', () => {
    const b = createBuffer(30, 1);
    for (let i = 0; i < 30; i++) b.put(i, 0, '.');
    b.commit();
    b.put(0, 0, 'a');
    b.put(20, 0, 'b');
    const frame = diffFrame(b, null, 4);
    expect(frame.runs).toHaveLength(2);
  });

  it('repaints everything after invalidate', () => {
    const b = createBuffer(4, 2);
    b.put(0, 0, 'a');
    b.commit();
    b.invalidate();
    expect(diffFrame(b).full).toBe(true);
  });
});
