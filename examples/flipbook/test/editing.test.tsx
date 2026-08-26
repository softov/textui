import { beforeEach, describe, expect, it } from 'vitest';
import { render } from '@textui/testing';
import { CX, CY, INK, loaded, registerFlipbook } from '../src/app.js';
import { key, parse } from '../src/motion.js';
import type { MotionDocument } from '../src/motion.js';
import { SAMPLE } from '../src/sample.js';

/**
 * The editor, driven by keys.
 *
 * Everything here is a bug that was reported against the running program, so
 * each case is written as the gesture that produced it rather than as the unit
 * that turned out to be wrong.
 */

const mount = async (mode: 'view' | 'edit' = 'edit') => {
  loaded.movie = parse(JSON.parse(JSON.stringify(SAMPLE)) as MotionDocument);
  loaded.path = null;
  loaded.saved = null;
  loaded.mode = mode;
  return render(
    { component: 'FlipbookFrame' },
    { width: 90, height: 24, onBoot: (app) => registerFlipbook(app) },
  );
};

const film = () => {
  if (!loaded.movie) throw new Error('not mounted');
  return loaded.movie;
};

describe('typing draws in the picked colour', () => {
  it('uses the ink the colour keys just set', async () => {
    const app = await mount();
    const cx = app.store.get(CX) as number;
    const cy = app.store.get(CY) as number;

    for (let i = 0; i < 4; i++) app.press('shift+right');
    const picked = app.store.get(INK) as string;

    app.press('a');
    const cell = film().frames[0]?.cells.get(key(cx, cy));
    expect(cell?.char).toBe('a');
    expect(cell?.color, 'typed cell carries the ink on screen').toBe(picked);
  });

  it('uses the ink a swatch click set', async () => {
    const app = await mount();
    // Find a swatch on screen rather than hard-coding where the panel put it.
    const lines = app.text().split('\n');
    const row = lines.findIndex((line) => /\u2588\u2588\u2588\s+#[0-9a-f]{6}/i.test(line));
    expect(row, 'a swatch is on screen').toBeGreaterThan(-1);
    const col = (lines[row] ?? '').indexOf('\u2588\u2588\u2588');
    const swatch = /#[0-9a-f]{6}/i.exec(lines[row] ?? '')?.[0];

    app.click(col + 1, row);
    const x = app.store.get(CX) as number, y = app.store.get(CY) as number;
    app.press('a');
    expect(film().frames[0]?.cells.get(key(x, y))?.color, 'typed cell carries the clicked swatch')
      .toBe(swatch);
  });
});

describe('the colour keys', () => {
  it('still changes hue after lightness has been to the top', async () => {
    const app = await mount();
    app.store.set(INK, '#3366cc');

    // Walk lightness up until it saturates, which is what a held key does.
    for (let i = 0; i < 30; i++) app.press('shift+up');
    const bright = app.store.get(INK) as string;

    for (let i = 0; i < 6; i++) app.press('shift+right');
    expect(app.store.get(INK), 'hue moved after lightness hit the ceiling')
      .not.toBe(bright);
  });

  it('still changes hue after lightness has been to the bottom', async () => {
    const app = await mount();
    app.store.set(INK, '#3366cc');
    for (let i = 0; i < 30; i++) app.press('shift+down');
    const dark = app.store.get(INK) as string;
    for (let i = 0; i < 6; i++) app.press('shift+left');
    expect(app.store.get(INK)).not.toBe(dark);
  });

  it('still works after a click on the canvas', async () => {
    const app = await mount();
    app.store.set(INK, '#3366cc');
    app.click(20, 10);
    const before = app.store.get(INK);
    app.press('shift+right');
    expect(app.store.get(INK), 'hue still moves after clicking the canvas').not.toBe(before);
  });

  it('still works after a click in the sidebar', async () => {
    const app = await mount();
    app.store.set(INK, '#3366cc');
    app.click(80, 6);
    const before = app.store.get(INK);
    app.press('shift+right');
    expect(app.store.get(INK), 'hue still moves after clicking the sidebar').not.toBe(before);
  });

  it('takes the colour a click on the ramp lands on', async () => {
    const app = await mount();
    const before = app.store.get(INK) as string;
    const lines = app.text().split('\n');
    // The ramp is the long run of solid blocks under the "hue" label.
    const row = lines.findIndex((line) => /\u2588{20,}/.test(line));
    expect(row, 'the hue ramp is on screen').toBeGreaterThan(-1);
    const col = (lines[row] ?? '').search(/\u2588{20,}/);

    app.click(col + 18, row);
    expect(app.store.get(INK), 'ramp click changed the ink').not.toBe(before);

    const picked = app.store.get(INK) as string;
    const x = app.store.get(CX) as number, y = app.store.get(CY) as number;
    app.press('a');
    expect(film().frames[0]?.cells.get(key(x, y))?.color, 'and typing uses it').toBe(picked);
  });

  it('leaves the cursor alone', async () => {
    const app = await mount();
    const cx = app.store.get(CX);
    const cy = app.store.get(CY);
    app.press('shift+up');
    app.press('shift+right');
    expect(app.store.get(CX)).toBe(cx);
    expect(app.store.get(CY)).toBe(cy);
  });
});

describe('the cursor', () => {
  it('keeps moving after the colour keys have been used', async () => {
    const app = await mount();
    const startX = app.store.get(CX) as number;

    app.press('shift+up');
    app.press('shift+down');
    app.press('right');
    app.press('right');

    expect(app.store.get(CX), 'left/right still move the cursor').toBe(startX + 2);
  });

  it('moves on plain arrows', async () => {
    const app = await mount();
    const x = app.store.get(CX) as number;
    const y = app.store.get(CY) as number;
    app.press('right');
    app.press('down');
    expect([app.store.get(CX), app.store.get(CY)]).toEqual([x + 1, y + 1]);
  });
});

describe('switching modes', () => {
  it('does not move the picture under the cursor', async () => {
    // The complaint: entering edit mode re-frames the canvas, so the drawing
    // jumps and every coordinate the eye had just learned is wrong.
    const playing = await mount('view');
    const before = playing.text();

    const editing = await mount('view');
    editing.press('ctrl+e');
    const after = editing.text();

    const strip = (text: string): string[] =>
      text.split('\n').map((line) => line.replace(/\s+$/, ''));

    // The pane narrows by the sidebar, so compare the rows that carry the
    // drawing rather than the whole screen: the picture must sit on the same
    // lines, not slide up or down the pane.
    const rowsWithArt = (text: string): number[] =>
      strip(text).flatMap((line, i) => (line.includes('@@') ? [i] : []));

    expect(rowsWithArt(after)).toEqual(rowsWithArt(before));
  });
});

describe('frames', () => {
  beforeEach(() => { loaded.mode = 'edit'; });

  it('steps on tab in either mode', async () => {
    const app = await mount('edit');
    expect(app.text()).toContain('1 / 3');
    app.press('tab');
    expect(app.text()).toContain('2 / 3');
    app.press('shift+tab');
    expect(app.text()).toContain('1 / 3');
  });
});
