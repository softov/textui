import { describe, expect, it } from 'vitest';
import { render } from '@textui/testing';
import { CX, CY, loaded, registerFlipbook } from '../src/app.js';
import { key, parse } from '../src/motion.js';
import type { MotionDocument } from '../src/motion.js';
import { SAMPLE } from '../src/sample.js';

/**
 * Where the pointer lands.
 *
 * Asserted as a round trip through the screen rather than against arithmetic:
 * put a character nowhere else on the canvas, find the one cell of the frame
 * buffer holding it, click that cell, and the cursor must report the canvas
 * coordinate it was drawn at. Any offset between the pane and the block of
 * text inside it shows up here and nowhere else.
 */

const mount = async (width: number, height: number) => {
  loaded.movie = parse(JSON.parse(JSON.stringify(SAMPLE)) as MotionDocument);
  loaded.path = null; loaded.saved = null; loaded.mode = 'edit';
  return render({ component: 'FlipbookFrame' },
    { width, height, onBoot: (app) => registerFlipbook(app) });
};

const findOnScreen = (app: Awaited<ReturnType<typeof mount>>, glyph: string) => {
  const lines = app.lines();
  for (let y = 0; y < lines.length; y++) {
    const x = (lines[y] ?? '').indexOf(glyph);
    if (x >= 0) return { x, y };
  }
  return null;
};

describe('clicking a cell', () => {
  for (const [w, h] of [[92, 24], [120, 40], [70, 18]] as const) {
    it(`reports the cell that was drawn there (${w}x${h})`, async () => {
      const app = await mount(w, h);
      const film = loaded.movie!;
      // Somewhere inside the drawing, so it is on screen at every size.
      const target = { x: 30, y: 42 };
      film.frames[0]?.cells.set(key(target.x, target.y), { char: 'Ω', color: '#ff0000' });
      app.press('right');   // force a repaint
      app.press('left');

      const spot = findOnScreen(app, 'Ω');
      expect(spot, 'the marker is on screen').not.toBeNull();

      app.click(spot!.x, spot!.y);
      expect([app.store.get(CX), app.store.get(CY)]).toEqual([target.x, target.y]);
    });
  }
});
