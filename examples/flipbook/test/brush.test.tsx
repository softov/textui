import { describe, expect, it } from 'vitest';
import { render } from '@textui/testing';
import type { InputEvent, MouseEvent } from '@textui/core';
import { ATTR_UNDERLINE } from '@textui/core';
import { CLIP, CX, CY, INK, loaded, registerFlipbook } from '../src/app.js';
import { key, parse } from '../src/motion.js';
import type { MotionDocument } from '../src/motion.js';
import { SAMPLE } from '../src/sample.js';

/**
 * Copy and paste, which arrive as modified clicks.
 *
 * The harness `click` sends no modifiers, so these drive `handleInput`
 * directly - which is also the honest thing to test, since a modified click is
 * exactly a mouse event with a flag set and nothing else.
 */

const mount = async () => {
  loaded.movie = parse(JSON.parse(JSON.stringify(SAMPLE)) as MotionDocument);
  loaded.path = null;
  loaded.saved = null;
  loaded.mode = 'edit';
  return render(
    { component: 'FlipbookFrame' },
    { width: 96, height: 26, onBoot: (app) => registerFlipbook(app) },
  );
};

const film = () => {
  if (!loaded.movie) throw new Error('not mounted');
  return loaded.movie;
};

type Harness = Awaited<ReturnType<typeof mount>>;

/**
 * A click carrying modifiers, which `click()` cannot express.
 *
 * `handleInput` is on the running application rather than on the `TextUIApp`
 * surface the harness publishes, so this reaches for it by hand. That is the
 * whole of the cast: the event itself is the ordinary one, with a flag set.
 */
type Sink = { handleInput(event: InputEvent): void };

function clickWith(app: Harness, x: number, y: number, mods: Partial<MouseEvent>): void {
  const sink = app.app as unknown as Sink;
  for (const action of ['down', 'up'] as const) {
    sink.handleInput({
      type: 'mouse', action, button: 'left', x, y,
      ctrl: false, alt: false, shift: false, at: 0, handled: false,
      ...mods,
    });
  }
}

/**
 * Where a canvas cell is on screen.
 *
 * The pane frames the drawing rather than starting at its origin, so the
 * mapping is read back from the cursor: put the cursor somewhere with a plain
 * click, and the footer reports which cell that was.
 */
function locate(app: Harness): { screenX: number; screenY: number; cellX: number; cellY: number } {
  const probeX = 20, probeY = 8;
  app.click(probeX, probeY);
  return {
    screenX: probeX, screenY: probeY,
    cellX: app.store.get(CX) as number,
    cellY: app.store.get(CY) as number,
  };
}

describe('ctrl+click copies', () => {
  it('takes the character and the colour under the pointer', async () => {
    const app = await mount();
    const at = locate(app);
    // Put something known where the pointer already is.
    film().frames[0]?.cells.set(key(at.cellX, at.cellY), { char: 'Q', color: '#ff0000' });

    clickWith(app, at.screenX, at.screenY, { ctrl: true });

    // The brush is the character. The colour goes to the pen instead, which
    // is what makes ctrl+click double as an eyedropper - and what lets the
    // brush follow the ink afterwards without a copy losing anything.
    expect(app.store.get(CLIP)).toBe('Q');
    expect(app.store.get(INK)).toBe('#ff0000');
  });

  it('takes a blank from an empty cell rather than refusing', async () => {
    const app = await mount();
    const at = locate(app);
    film().frames[0]?.cells.delete(key(at.cellX, at.cellY));
    const penBefore = app.store.get(INK);

    clickWith(app, at.screenX, at.screenY, { ctrl: true });

    expect(app.store.get(CLIP)).toBe(' ');
    // A blank carries no colour worth adopting, so the pen is left alone.
    expect(app.store.get(INK)).toBe(penBefore);
  });
});

describe('the brush follows the ink', () => {
  /*
   * What a person sees when they change the colour: the character sitting in
   * the brush is the next thing about to use it, and it went on showing the
   * colour it was lifted at. Carrying the colour on the brush is what did it,
   * and dropping it costs nothing, because a copy sets the ink to what it
   * found - so copy-then-paste still reproduces the cell exactly.
   */
  it('pastes in the colour chosen after the copy, not the one copied', async () => {
    const app = await mount();
    const at = locate(app);
    film().frames[0]?.cells.set(key(at.cellX, at.cellY), { char: 'Q', color: '#ff0000' });

    clickWith(app, at.screenX, at.screenY, { ctrl: true });
    expect(app.store.get(INK)).toBe('#ff0000');

    // The colour moves after the copy, which is the whole report. Settle so
    // the handlers are the ones the new ink was rendered with - in the
    // application a keystroke does that on its own.
    app.store.set(INK, '#00ff00');
    await app.settle();
    clickWith(app, at.screenX + 4, at.screenY + 1, { shift: true });
    const target = { x: app.store.get(CX) as number, y: app.store.get(CY) as number };

    expect(film().frames[0]?.cells.get(key(target.x, target.y)))
      .toEqual({ char: 'Q', color: '#00ff00' });
  });

  it('still reproduces the cell when nothing is changed in between', async () => {
    const app = await mount();
    const at = locate(app);
    film().frames[0]?.cells.set(key(at.cellX, at.cellY), { char: 'Q', color: '#ff0000' });

    clickWith(app, at.screenX, at.screenY, { ctrl: true });
    clickWith(app, at.screenX + 4, at.screenY + 1, { shift: true });
    const target = { x: app.store.get(CX) as number, y: app.store.get(CY) as number };

    expect(film().frames[0]?.cells.get(key(target.x, target.y)))
      .toEqual({ char: 'Q', color: '#ff0000' });
  });

  it('draws the held character in the ink, and repaints when it changes', async () => {
    const app = await mount();
    const at = locate(app);
    film().frames[0]?.cells.set(key(at.cellX, at.cellY), { char: 'Q', color: '#ff0000' });
    clickWith(app, at.screenX, at.screenY, { ctrl: true });
    await app.settle();

    // The sidebar is the right-hand `SIDEBAR` columns, so a `Q` found there is
    // the brush's own swatch rather than the one on the canvas.
    const swatchInk = (): unknown => {
      const buffer = app.app.buffer();
      for (let y = 0; y < 26; y++) {
        for (let x = 96 - 26; x < 96; x++) {
          const cell = buffer.get(x, y);
          if (cell?.char === 'Q') return cell.fg;
        }
      }
      return undefined;
    };

    const before = swatchInk();
    expect(before).toBeDefined();

    app.store.set(INK, '#00ff00');
    await app.settle();

    // The point of the report: the glyph in the sidebar is drawn in the ink
    // now, so it moves with it rather than sitting at the colour it was
    // lifted at.
    const after = swatchInk();
    expect(after).toBeDefined();
    expect(after).not.toBe(before);
  });
});

describe('shift+click pastes', () => {
  it('puts the copied cell down somewhere else', async () => {
    const app = await mount();
    const at = locate(app);
    film().frames[0]?.cells.set(key(at.cellX, at.cellY), { char: 'Q', color: '#ff0000' });
    clickWith(app, at.screenX, at.screenY, { ctrl: true });

    clickWith(app, at.screenX + 4, at.screenY + 1, { shift: true });
    const target = { x: app.store.get(CX) as number, y: app.store.get(CY) as number };

    expect(target).not.toEqual({ x: at.cellX, y: at.cellY });
    expect(film().frames[0]?.cells.get(key(target.x, target.y)))
      .toEqual({ char: 'Q', color: '#ff0000' });
  });

  it('erases when the brush holds a blank', async () => {
    const app = await mount();
    const at = locate(app);
    film().frames[0]?.cells.delete(key(at.cellX, at.cellY));
    clickWith(app, at.screenX, at.screenY, { ctrl: true });

    const victim = { x: at.cellX + 4, y: at.cellY + 1 };
    film().frames[0]?.cells.set(key(victim.x, victim.y), { char: 'Z', color: '#00ff00' });
    clickWith(app, at.screenX + 4, at.screenY + 1, { shift: true });

    // Gone from the map, not left behind as a painted space - the format
    // distinguishes the two and only one of them is really empty.
    expect(film().frames[0]?.cells.has(key(victim.x, victim.y))).toBe(false);
  });

  it('does nothing at all when nothing has been copied', async () => {
    const app = await mount();
    const at = locate(app);
    const target = { x: at.cellX + 4, y: at.cellY + 1 };
    film().frames[0]?.cells.set(key(target.x, target.y), { char: 'K', color: '#0000ff' });

    expect(app.store.get(CLIP)).toBeNull();
    clickWith(app, at.screenX + 4, at.screenY + 1, { shift: true });

    expect(film().frames[0]?.cells.get(key(target.x, target.y)))
      .toEqual({ char: 'K', color: '#0000ff' });
  });

  it('leaves the picture alone while it is playing', async () => {
    loaded.mode = 'view';
    const app = await render(
      { component: 'FlipbookFrame' },
      { width: 96, height: 26, onBoot: (a) => registerFlipbook(a) },
    );
    const before = film().frames[0]?.cells.size;
    clickWith(app, 20, 8, { ctrl: true });
    clickWith(app, 24, 9, { shift: true });
    expect(app.store.get(CLIP)).toBeNull();
    expect(film().frames[0]?.cells.size).toBe(before);
  });
});

describe('the cursor', () => {
  it('marks exactly one cell, with an underline', async () => {
    const app = await mount();
    const at = locate(app);

    const buffer = app.app.buffer();
    const underlined: { x: number; y: number }[] = [];
    for (let y = 0; y < 26; y++) {
      for (let x = 0; x < 96; x++) {
        const cell = buffer.get(x, y);
        if (cell && (cell.attrs & ATTR_UNDERLINE) !== 0) underlined.push({ x, y });
      }
    }

    // One cell only - a cursor that underlines a whole run is a style leak.
    expect(underlined).toEqual([{ x: at.screenX, y: at.screenY }]);
  });

  it('leaves the character under it readable', async () => {
    const app = await mount();
    const at = locate(app);
    film().frames[0]?.cells.set(key(at.cellX, at.cellY), { char: 'Q', color: '#ff0000' });
    // Nudge off the cell and back, so the edit is painted.
    app.press('right');
    app.press('left');

    const cell = app.app.buffer().get(at.screenX, at.screenY);
    expect(cell?.char).toBe('Q');
    expect((cell?.attrs ?? 0) & ATTR_UNDERLINE).not.toBe(0);
  });
});

describe('the insert keys', () => {
  it('copies with ctrl+insert and pastes with shift+insert', async () => {
    const app = await mount();
    const at = locate(app);
    film().frames[0]?.cells.set(key(at.cellX, at.cellY), { char: 'Q', color: '#ff0000' });

    app.press('ctrl+insert');
    expect(app.store.get(CLIP)).toBe('Q');

    app.press('right');
    app.press('shift+insert');
    expect(film().frames[0]?.cells.get(key(at.cellX + 1, at.cellY)))
      .toEqual({ char: 'Q', color: '#ff0000' });
  });

  it('also pastes with alt+insert, for terminals that keep shift', async () => {
    const app = await mount();
    const at = locate(app);
    film().frames[0]?.cells.set(key(at.cellX, at.cellY), { char: 'W', color: '#00ff00' });

    app.press('ctrl+insert');
    app.press('down');
    app.press('alt+insert');
    expect(film().frames[0]?.cells.get(key(at.cellX, at.cellY + 1)))
      .toEqual({ char: 'W', color: '#00ff00' });
  });

  it('says so when there is nothing to paste', async () => {
    const app = await mount();
    locate(app);
    app.press('shift+insert');
    expect(app.text()).toContain('nothing copied yet');
  });

  it('leaves the cursor where it was', async () => {
    const app = await mount();
    const at = locate(app);
    app.press('ctrl+insert');
    app.press('shift+insert');
    expect([app.store.get(CX), app.store.get(CY)]).toEqual([at.cellX, at.cellY]);
  });
});
