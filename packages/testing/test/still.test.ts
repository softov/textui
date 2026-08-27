import { describe, expect, it } from 'vitest';
import { h, defineComponent, useState, useEffect, useMeasure } from '@textui/core';
import { renderStill } from '@textui/terminal';

/**
 * One frame, and the question of when it is finished.
 *
 * Every example in this repository used to end its print path with a sleep
 * loop of four milliseconds times a number somebody had tried until the
 * picture looked right - eight, mostly, four in one and twelve in another.
 * The number was never the point; the point is that a frame settles in more
 * than one pass and there was no way to ask whether it had.
 *
 * So these are about the passes, not the milliseconds: a component that only
 * knows its size after it has been laid out, and one that changes its mind in
 * an effect, both have to be finished before the frame is taken.
 */

/** Draws nothing until it has been measured, then draws its own width. */
const Measured = defineComponent<Record<string, never>>('Measured', () => {
  const rect = useMeasure();
  return h('box', { flex: 1 }, h('text', { content: rect.width > 0 ? `w=${rect.width}` : '' }));
});

/** Settles on its second thought, one effect later. */
const Deferred = defineComponent<Record<string, never>>('Deferred', () => {
  const [state, setState] = useState('first');
  useEffect(() => { setState('second'); }, []);
  return h('text', { content: state });
});

/**
 * Never converges, which is what a limit is for.
 *
 * Not a ticker - one of those settles between its frames, which is what makes
 * a still of an animation possible. This is the other thing: an effect with no
 * dependency list, setting the state it reads, so every pass produces another.
 */
const Restless = defineComponent<Record<string, never>>('Restless', () => {
  const [n, setN] = useState(0);
  useEffect(() => { setN(n + 1); });
  return h('text', { content: `tick ${n}` });
});

describe('renderStill', () => {
  it('waits for a component that has to be measured first', async () => {
    const still = await renderStill({ width: 24, height: 3, root: h(Measured, {}) });
    expect(still.settled).toBe(true);
    expect(still.text).toContain('w=24');
  });

  it('waits for an effect that changes its mind', async () => {
    const still = await renderStill({ width: 24, height: 3, root: h(Deferred, {}) });
    expect(still.text).toContain('second');
    expect(still.text).not.toContain('first');
  });

  it('says so rather than hanging on something that never stops', async () => {
    const still = await renderStill({
      width: 24, height: 3, root: h(Restless, {}), settleLimit: 3,
    });
    // Reported rather than hidden, and the frame is taken anyway: a still is
    // better evidence of a loop that will not converge than nothing is.
    expect(still.settled).toBe(false);
    expect(still.text).toContain('tick');
  });

  it('drives it before the frame, and reaches it after', async () => {
    const order: string[] = [];
    const still = await renderStill({
      width: 24, height: 3,
      root: h('text', { content: 'body' }),
      before: () => { order.push('before'); },
      after: (app) => {
        order.push('after');
        // Alive, and its buffer is the one about to be captured.
        expect(app.buffer().width).toBe(24);
      },
    });
    expect(order).toEqual(['before', 'after']);
    expect(still.text).toContain('body');
  });

  it('captures what `after` changed, not what was there before it', async () => {
    // Which is the whole reason `after` runs on this side of the capture: the
    // showcase crops four hundred rows down to the ones it used.
    const still = await renderStill({
      width: 12, height: 8,
      root: h('text', { content: 'kept' }),
      after: (app) => { app.buffer().resize(12, 1); },
    });
    expect(still.text.split('\n')).toHaveLength(1);
    expect(still.text).toContain('kept');
  });

  it('hands back cells as well as text, and they outlive the application', async () => {
    const still = await renderStill({ width: 10, height: 2, root: h('text', { content: 'A' }) });
    expect(still.buffer.width).toBe(10);
    expect(still.buffer.get(0, 0)?.char).toBe('A');
  });

  it('leaves the colour out when asked, which is what a diff can read', async () => {
    const still = await renderStill({
      width: 12, height: 2,
      root: h('text', { content: 'plain', fg: 'danger' }),
      capture: { colors: false },
    });
    // eslint-disable-next-line no-control-regex
    expect(/\[/.test(still.text)).toBe(false);
  });
});
