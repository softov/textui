import { describe, expect, it } from 'vitest';
import { render } from '@textui/testing';
import type { Harness } from '@textui/testing';
import { registerSurfaces } from '../src/app.js';

/**
 * The example, mounted.
 *
 * These are the three things nothing else in the repo covers. Every shipped
 * shell places its own surfaces, so the shells' tests exercise a surface that
 * a shell already made - they never exercise an application inventing one,
 * filling it, nesting one inside another, or putting one into a layout the
 * application wrote itself. All four happen here.
 */

const SIZES = [
  { width: 92, height: 22 },
  { width: 74, height: 16 },
];

async function open(size = SIZES[0] as { width: number; height: number }): Promise<Harness> {
  // `render` takes the root node; `builtins: false` is what makes this an
  // application with no shell rather than one with `plain`.
  const t = await render({ component: 'SurfacesFrame' }, {
    ...size,
    builtins: false,
    onBoot: (app) => { registerSurfaces(app); },
  });
  for (let i = 0; i < 8; i++) await t.settle();
  return t;
}

describe('surfaces, with no shell', () => {
  for (const size of SIZES) {
    it(`draws its own chrome at ${size.width}x${size.height}`, async () => {
      const t = await open(size);
      expect(t.errors()).toEqual([]);

      // Nothing answers to the default shell id, and the frame renders anyway.
      expect(t.app.activeShell()).toBe('plain');
      expect(t.app.shells.get('plain')).toBeUndefined();
      expect(t.hasText('no shell registered')).toBe(true);

      // A missing registration draws its own diagnostic rather than nothing,
      // so an empty assertion could never pass by accident.
      expect(t.text()).not.toContain('[textui]');
      await t.unmount();
    });
  }

  it('brings a surface into being by naming it', async () => {
    const t = await open();

    // `canvas` is not in `SurfaceName`'s suggested list, and never registered.
    expect(t.app.surfaces.state('canvas').layout).toBe('region');
    expect(t.app.surfaces.mounts('canvas').map((m) => m.key)).toEqual([
      'north:panel', 'west:panel', 'centre:panel', 'east:panel', 'south:panel',
    ]);

    // A name it has never seen gets default state rather than an error.
    expect(t.app.surfaces.state('never-mentioned')).toMatchObject({
      visible: true, activeKey: null,
    });
    await t.unmount();
  });

  it('renders a surface mounted inside another surface', async () => {
    const t = await open();

    const holder = t.app.surfaces.mounts('nav').find((m) => m.key === 'inspector');
    expect(holder?.target).toMatchObject({ component: 'SurfaceArea', surface: 'inspector' });

    // The nested surface's own mount is on screen, two surfaces deep.
    expect(t.hasText('mounted in')).toBe(true);
    expect(t.app.surfaces.mounts('inspector').map((m) => m.key)).toEqual(['facts']);
    await t.unmount();
  });

  it('puts a surface into a layout the application registered', async () => {
    const t = await open();
    expect(t.app.layouts.get('region')?.component).toBe('RegionLayout');

    // The border layout is doing the placing: north is above the middle row,
    // and west/centre/east share it.
    const lines = t.lines();
    const row = (text: string) => lines.findIndex((l) => l.includes(text));
    expect(row('north')).toBeGreaterThan(-1);
    expect(row('west')).toBeGreaterThan(row('north'));
    expect(row('south')).toBeGreaterThan(row('west'));
    expect(lines[row('west')]).toContain('centre');
    expect(lines[row('west')]).toContain('east');
    await t.unmount();
  });

  it('changes layout without remounting anything', async () => {
    const t = await open();
    const before = t.app.surfaces.mounts('canvas').map((m) => m.key);

    t.press('2');
    for (let i = 0; i < 4; i++) await t.settle();

    expect(t.app.surfaces.state('canvas').layout).toBe('tabs');
    // Same mounts, handed to a different component. A layout is state.
    expect(t.app.surfaces.mounts('canvas').map((m) => m.key)).toEqual(before);
    expect(t.errors()).toEqual([]);

    t.press('1');
    for (let i = 0; i < 4; i++) await t.settle();
    expect(t.app.surfaces.state('canvas').layout).toBe('region');
    await t.unmount();
  });
});
