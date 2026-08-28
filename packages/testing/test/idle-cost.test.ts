import { describe, expect, it } from 'vitest';
import { h, useFrame } from '@textui/core';
import { Column } from '@textui/widgets';
import { renderApp } from '../src/index.js';

/*
 * Two ways an application asks to be redrawn when nothing has happened.
 *
 * Both are invisible in a small tree and are the whole frame budget in a
 * large one, which is the tree nobody builds to test with.
 */

describe('a ticker that is not ticking', () => {
  const sometimes = (running: boolean) => h(function Blink() {
    // The caret is drawn while something is arriving, and not otherwise -
    // which is the same shape as a spinner, a marquee and a blinking cursor.
    const frame = useFrame(2, { enabled: running });
    return h('text', { content: frame % 2 === 0 ? 'o' : ' ' });
  }, {});

  const open = async (running: boolean) => {
    const t = await renderApp({
      width: 40,
      height: 10,
      root: h(Column, { flex: 1 }, ...Array.from({ length: 50 }, (_, i) => h(Column, { key: i }, sometimes(running)))),
    });
    for (let i = 0; i < 4; i++) await t.settle();
    return t;
  };

  it('leaves the application alone while it is off', async () => {
    const t = await open(false);
    const app = t.app as unknown as { animation: { advance(ms: number): void }; isDirty(): boolean };
    expect(app.isDirty()).toBe(false);
    app.animation.advance(2000);
    // A standing invalidation is one every component that has it, twice a
    // second, for as long as it is mounted.
    expect(app.isDirty()).toBe(false);
    await t.unmount();
  });

  it('still ticks while it is on', async () => {
    const t = await open(true);
    const app = t.app as unknown as { animation: { advance(ms: number): void }; isDirty(): boolean };
    app.animation.advance(2000);
    expect(app.isDirty()).toBe(true);
    await t.unmount();
  });
});
