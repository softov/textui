import { describe, expect, it } from 'vitest';
import { h, useKeymap, useState, useInterval } from '@textui/core';
import { render } from '../src/index.js';

// The counter example, near enough to be the same program.
const Counter = () => {
  const [count, setCount] = useState(0);
  const [running, setRunning] = useState(false);

  useKeymap({
    '+': () => { setCount((c) => c + 1); },
    '=': () => { setCount((c) => c + 1); },
    '-': () => { setCount((c) => c - 1); },
    space: () => { setRunning((r) => !r); },
    r: () => { setCount(0); setRunning(false); },
  });
  useInterval(() => { setCount((c) => c + 1); }, 20, running);

  return h('box', { direction: 'column' },
    h('text', { content: `Count: ${count}` }),
    h('text', { content: running ? 'running' : 'stopped' }),
  );
};

for (const size of [{ width: 40, height: 6 }, { width: 20, height: 4 }]) {
  describe(`useKeymap at ${size.width}x${size.height}`, () => {
    it('binds a key by the name the registry writes it under', async () => {
      const t = await render(h(Counter, {}), size);
      t.pressAll('+', '+', '+');
      await t.settle();
      expect(t.text()).toContain('Count: 3');

      t.pressAll('-', '-');
      await t.settle();
      expect(t.text()).toContain('Count: 1');
      await t.unmount();
    });

    it('takes the unshifted spelling too', async () => {
      const t = await render(h(Counter, {}), size);
      t.pressAll('=', '=');
      await t.settle();
      expect(t.text()).toContain('Count: 2');
      await t.unmount();
    });

    it('ignores a key it was not given', async () => {
      const t = await render(h(Counter, {}), size);
      t.pressAll('x', 'q', 'down');
      await t.settle();
      expect(t.text()).toContain('Count: 0');
      await t.unmount();
    });
  });
}

describe('useKeymap and a timer', () => {
  it('space starts and stops the interval', async () => {
    const t = await render(h(Counter, {}), { width: 40, height: 6 });
    expect(t.text()).toContain('stopped');

    t.press('space');
    await t.settle();
    expect(t.text()).toContain('running');

    t.press('space');
    await t.settle();
    expect(t.text()).toContain('stopped');
    await t.unmount();
  });

  it('r resets both', async () => {
    const t = await render(h(Counter, {}), { width: 40, height: 6 });
    t.pressAll('+', '+', 'space');
    await t.settle();
    expect(t.text()).toContain('running');

    t.press('r');
    await t.settle();
    expect(t.text()).toContain('Count: 0');
    expect(t.text()).toContain('stopped');
    await t.unmount();
  });

  // Global by default is the whole reason this is not `useInput`: a screen
  // with a focusable on it must not lose its keys to the focusable.
  it('works with something else focused', async () => {
    const WithInput = () => h('box', { direction: 'column' },
      h(Counter, {}),
      h('Button', { label: 'elsewhere', autoFocus: true }),
    );
    const t = await render(h(WithInput, {}), { width: 40, height: 8 });
    t.pressAll('+', '+');
    await t.settle();
    expect(t.text()).toContain('Count: 2');
    await t.unmount();
  });
});
