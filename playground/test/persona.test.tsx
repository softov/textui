import { describe, expect, it } from 'vitest';
import { renderApp } from '@textui/testing';
import {
  HEIGHT, MOODS, SIDES, WIDTH, checkHat, checkPersona, drawPersona,
} from '../src/components/persona.js';
import { HATS, PERSONAS, bug, owl } from '../src/components/personas.js';
import { findPlayground, setupPlayground } from '../src/registry.js';

/**
 * A persona is assembled, not drawn.
 *
 * Which is the opposite of what the chat example's creatures do, on purpose:
 * those are one figure drawn by hand at each size, and this is a puppet whose
 * whole point is that a head, a pair of eyes and a set of feet recombine. The
 * things worth asserting are the ones a template makes possible to get wrong -
 * that every combination is still five by seven, and that a part with no
 * left-facing version still faces left.
 */
describe('a persona', () => {
  it('is five rows of seven, in every combination', () => {
    for (const spec of PERSONAS) {
      for (const side of SIDES) {
        for (const mood of MOODS) {
          for (const at of [0, 1, 2, 3]) {
            const rows = drawPersona(spec, { side, mood, at });
            expect(rows).toHaveLength(HEIGHT);
            for (const row of rows) expect([...row]).toHaveLength(WIDTH);
          }
        }
      }
    }
  });

  it('says what is wrong with the art rather than drawing it wrong', () => {
    for (const spec of PERSONAS) expect(checkPersona(spec)).toEqual([]);

    // A row one cell too wide does not look wide on somebody else's terminal,
    // it looks broken - so it is caught here rather than on the screen.
    expect(checkPersona({
      ...owl,
      name: 'too-wide',
      middle: { normal: ['12345678'] },
    })).toEqual(['too-wide: middle.normal[0] is 8 cells, over 7']);
  });

  it('falls back to the front-facing part when a side was not drawn', () => {
    // A body that looks the same either way should not have to be stated
    // three times, and a persona that made you do it would be a persona
    // nobody finishes.
    expect(drawPersona(owl, { side: 'left' })[3]).toBe(drawPersona(owl, { side: 'normal' })[3]);
    // ...while the eyes, which *were* drawn per side, do differ.
    expect(drawPersona(owl, { side: 'left' })[2]).not.toBe(drawPersona(owl, { side: 'right' })[2]);
  });

  it('stands still on frame zero, whatever the path says', () => {
    // Frame zero is what shows with animation off, in a snapshot and in a
    // test, so it is the frame worth getting right.
    expect(drawPersona(owl, { at: 0 })).toEqual(drawPersona(owl, { at: 0 }));
    expect(drawPersona(owl, { at: 0 })[4]).not.toBe(drawPersona(owl, { at: 1 })[4]);
  });

  it('keeps the feet on the same line whether or not there is a hat', () => {
    // A hat that moved the feet would be a hat that changed how tall somebody
    // is, which is one part deciding another part's row.
    const worn = drawPersona(owl, { hat: HATS[1] as never });
    const bare = drawPersona(owl, { hat: null });
    expect(worn).toHaveLength(bare.length);
    expect(worn[4]).toBe(bare[4]);
    expect(bare[0]?.trim()).toBe('');
    expect(bare[1]?.trim()).toBe('');
  });

  /**
   * The question the first attempt got wrong: a hat that were a field on a
   * figure could only ever be worn by that figure.
   */
  it('puts any hat on anybody', () => {
    for (const hat of HATS) {
      expect(checkHat(hat)).toEqual([]);
      for (const spec of PERSONAS) {
        const rows = drawPersona(spec, { hat });
        expect(rows).toHaveLength(HEIGHT);
        // The hat is the top two rows and nothing below them moved.
        expect(rows.slice(2)).toEqual(drawPersona(spec, { hat: null }).slice(2));
      }
    }
    // ...and the same hat really is the same drawing on two different heads.
    expect(drawPersona(owl, { hat: HATS[2] as never }).slice(0, 2))
      .toEqual(drawPersona(bug, { hat: HATS[2] as never }).slice(0, 2));
  });

  /**
   * The other thing it got wrong: the eyes are set *into* the head, not given
   * a row of their own. A mood is four short strings rather than four whole
   * heads, and looking sideways moves the eyes rather than redrawing the face.
   */
  it('sets the eyes into the head rather than beside it', () => {
    const head = drawPersona(owl, { mood: 'normal' })[2] as string;
    expect(head).toBe(' (oo ) ');
    // The frame of the head is untouched by every mood.
    for (const mood of MOODS) {
      const row = drawPersona(owl, { mood })[2] as string;
      expect(row[1]).toBe('(');
      expect(row[5]).toBe(')');
    }
    // ...and facing right moves them within it.
    expect(drawPersona(owl, { side: 'right' })[2]).toBe(' ( oo) ');
  });
});

describe('the persona in the scene', () => {
  const mount = async () => {
    const p = findPlayground('scene')!;
    const t = await renderApp({
      width: 80, height: 22, shell: 'plain', theme: 'workbench',
      onBoot: (app) => { setupPlayground(app, p); app.open({ surface: 'main', key: 'scene', target: p.node() }); },
    });
    for (let i = 0; i < 5; i++) await t.settle();
    return t;
  };

  /**
   * Where the feet are.
   *
   * A foot is a `J` or an `L` - the two directions one points - so the pattern
   * has to take either at either end: a figure that walked right holds its
   * right-facing stride after it stops, which is `L L` and not `J L`. Nothing
   * else in the scene draws those letters, so one match is the feet.
   *
   * `.` rather than `\s` between them, and `{0,2}` rather than `{1,2}`: the
   * cells between the feet are not painted at all, so whatever is behind the
   * figure shows through them - a cloud, a flower, the sky. Matching a space
   * there asserts the figure carries an opaque rectangle around with it, which
   * is the thing it was changed to stop doing. And mid-stride the feet come
   * together, with nothing between them at all.
   */
  const FEET = /[JL].{0,2}[JL]/;
  const feet = (t: Awaited<ReturnType<typeof mount>>): { x: number; y: number } => {
    const y = t.lines().findIndex((line) => FEET.test(line));
    return { x: (t.lines()[y] ?? '').search(/[JL]/), y };
  };

  it('stands on the ground until it is sent somewhere', async () => {
    const t = await mount();
    const { y } = feet(t);
    expect(y).toBeGreaterThan(15);
    await t.unmount();
  });

  it('walks to the click, and arrives under it', async () => {
    const t = await mount();
    t.click(64, 8);
    // The walk is a clock, so the clock has to run. One cell per tick.
    for (let i = 0; i < 80; i++) { t.advance(90); await t.settle(); }

    // Standing on the pointer rather than beside it: the figure is seven
    // wide and five tall, and the click is its feet.
    const at = feet(t);
    expect(at.y).toBe(8);
    expect(Math.abs(at.x - 64)).toBeLessThanOrEqual(3);
    await t.unmount();
  });

  /**
   * The figure has no background of its own.
   *
   * A `text` paints every cell it is given, spaces included, in whatever
   * background it inherits - so a figure drawn in a layer over the scene
   * arrives as a seven-by-five rectangle of the application's canvas cut out
   * of the sky. Drawing it inside the bands, and drawing only the marks, is
   * what makes it stand *in* the scene rather than on a sticker.
   */
  it('lets the scene show through it', async () => {
    const t = await mount();
    t.click(40, 4);
    for (let i = 0; i < 80; i++) { t.advance(90); await t.settle(); }

    const at = feet(t);
    // Without this the whole assertion is vacuous: two cells nobody found are
    // two `undefined`s, and `undefined === undefined`. It has caught the feet
    // pattern going stale once already.
    expect(at.y).toBeGreaterThanOrEqual(0);

    const buf = t.app.buffer();
    const sky = buf.get(2, at.y)?.bg;
    // The cell the figure occupies has the sky's background, not the
    // application's - because the sky is what drew it.
    expect(JSON.stringify(buf.get(at.x, at.y)?.bg)).toBe(JSON.stringify(sky));
    await t.unmount();
  });

  it('stops when it gets there, rather than holding a ticker for ever', async () => {
    const t = await mount();
    t.click(30, 10);
    for (let i = 0; i < 80; i++) { t.advance(90); await t.settle(); }
    const arrived = t.text();

    // A still figure holds no ticker at all, which is what keeps a scene with
    // a persona in it as cheap as one without.
    for (let i = 0; i < 20; i++) { t.advance(90); await t.settle(); }
    expect(t.text()).toBe(arrived);
    await t.unmount();
  });
});
