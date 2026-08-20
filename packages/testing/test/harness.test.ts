import { describe, expect, it } from 'vitest';
import { render, renderApp, snapshot } from '../src/index.js';
import { h, defineComponent, useState } from '@textui/core';

describe('rendering', () => {
  it('renders a node to text', async () => {
    const t = await render({ component: 'text', content: 'hello' }, { width: 20, height: 3 });
    expect(t.text().trim()).toBe('hello');
    await t.unmount();
  });

  it('renders the catalog by name', async () => {
    const t = await render(
      { component: 'Badge', label: 'up', tone: 'success', icon: '*' },
      { width: 20, height: 3 },
    );
    expect(t.hasText('up')).toBe(true);
    await t.unmount();
  });

  it('reports a missing component visibly', async () => {
    const t = await render({ component: 'Nope' }, { width: 30, height: 3 });
    expect(t.hasText('Nope')).toBe(true);
    await t.unmount();
  });
});

describe('semantic queries', () => {
  it('finds by role', async () => {
    const t = await render(
      { component: 'Button', label: 'Restart', tone: 'primary' },
      { width: 30, height: 3 },
    );
    const button = t.getByRole('button');
    expect(button.label).toBe('Restart');
    await t.unmount();
  });

  it('finds by role and name when several exist', async () => {
    const t = await render(
      {
        component: 'box',
        direction: 'row',
        gap: 1,
        children: [
          { component: 'Button', label: 'Save' },
          { component: 'Button', label: 'Cancel' },
        ],
      },
      { width: 40, height: 3 },
    );
    expect(t.getAllByRole('button')).toHaveLength(2);
    expect(t.getByRole('button', { name: 'Cancel' }).label).toBe('Cancel');
    await t.unmount();
  });

  it('throws a readable error when a query matches nothing', async () => {
    const t = await render({ component: 'text', content: 'x' }, { width: 20, height: 2 });
    expect(() => t.getByRole('table')).toThrow(/no element matching role "table"/);
    await t.unmount();
  });

  it('throws when a query is ambiguous', async () => {
    const t = await render(
      {
        component: 'box',
        children: [
          { component: 'Button', label: 'Go' },
          { component: 'Button', label: 'Go' },
        ],
      },
      { width: 30, height: 4 },
    );
    expect(() => t.getByRole('button')).toThrow(/2 elements match/);
    await t.unmount();
  });

  it('finds by text', async () => {
    const t = await render({ component: 'text', content: 'billing-worker' }, { width: 30, height: 2 });
    expect(t.getByText('billing').text).toBe('billing-worker');
    await t.unmount();
  });
});

describe('state and input', () => {
  const Counter = defineComponent<{ start?: number }>('Counter', ({ start = 0 }) => {
    const [count, setCount] = useState(start);
    return h('box', { direction: 'column' },
      h('text', { content: `count ${count}` }),
      h('Button', { label: 'inc', onPress: () => setCount(count + 1), autoFocus: true }),
    );
  });

  it('re-renders on state change', async () => {
    const t = await render(h(Counter, {}), { width: 30, height: 5 });
    expect(t.hasText('count 0')).toBe(true);

    t.press('enter');
    expect(t.hasText('count 1')).toBe(true);

    t.press('enter');
    expect(t.hasText('count 2')).toBe(true);
    await t.unmount();
  });

  it('activates a button by clicking it', async () => {
    const t = await render(h(Counter, {}), { width: 30, height: 5 });
    t.clickOn(t.getByRole('button'));
    expect(t.hasText('count 1')).toBe(true);
    await t.unmount();
  });
});

describe('focus', () => {
  const Three = defineComponent('Three', () =>
    h('box', { direction: 'column' },
      h('Button', { label: 'one', autoFocus: true }),
      h('Button', { label: 'two' }),
      h('Button', { label: 'three' })),
  );

  it('moves focus with tab', async () => {
    const t = await render(h(Three, {}), { width: 30, height: 8 });
    expect(t.focused()?.label).toBe('one');

    t.tab();
    expect(t.focused()?.label).toBe('two');

    t.tab();
    expect(t.focused()?.label).toBe('three');
    await t.unmount();
  });

  it('wraps around at the end', async () => {
    const t = await render(h(Three, {}), { width: 30, height: 8 });
    t.pressAll('tab', 'tab', 'tab');
    expect(t.focused()?.label).toBe('one');
    await t.unmount();
  });

  it('moves backwards with shift+tab', async () => {
    const t = await render(h(Three, {}), { width: 30, height: 8 });
    t.shiftTab();
    expect(t.focused()?.label).toBe('three');
    await t.unmount();
  });

  it('focuses what was clicked', async () => {
    const t = await render(h(Three, {}), { width: 30, height: 8 });
    const three = t.getByRole('button', { name: 'three' });
    t.clickOn(three);
    expect(t.focused()?.label).toBe('three');
    await t.unmount();
  });
});

describe('text input', () => {
  const Field = defineComponent('Field', () => {
    const [value, setValue] = useState('');
    return h('box', { direction: 'column' },
      h('TextInput', { value, onChange: setValue, label: 'name', autoFocus: true }),
      h('text', { content: `value=${value}` }),
    );
  });

  it('accepts typed characters', async () => {
    const t = await render(h(Field, {}), { width: 40, height: 6 });
    t.type('softov');
    expect(t.hasText('value=softov')).toBe(true);
    await t.unmount();
  });

  it('deletes with backspace', async () => {
    const t = await render(h(Field, {}), { width: 40, height: 6 });
    t.type('abc');
    t.press('backspace');
    expect(t.hasText('value=ab')).toBe(true);
    await t.unmount();
  });

  it('inserts at the caret', async () => {
    const t = await render(h(Field, {}), { width: 40, height: 6 });
    t.type('ac');
    t.press('left');
    t.type('b');
    expect(t.hasText('value=abc')).toBe(true);
    await t.unmount();
  });

  it('takes a paste as one insertion, not as keystrokes', async () => {
    const t = await render(h(Field, {}), { width: 40, height: 6 });
    t.paste('pasted text');
    expect(t.hasText('value=pasted text')).toBe(true);
    await t.unmount();
  });

  it('a plain character reaches the field, not a keybinding', async () => {
    const t = await renderApp({
      width: 40,
      height: 6,
      onBoot: (app) => {
        app.commands.register({ id: 'app.quit', title: 'Quit', run: () => app.store.set('$/quit', true) });
        app.keybindings.register({ keys: 'q', commandId: 'app.quit' });
        app.open({ surface: 'main', key: 'f', target: h(Field, {}) });
      },
    });
    t.type('q');
    expect(t.store.get('$/quit')).toBeUndefined();
    expect(t.hasText('value=q')).toBe(true);
    await t.unmount();
  });
});

describe('resizing and capabilities', () => {
  it('re-lays out on resize', async () => {
    const t = await render(
      { component: 'box', direction: 'row', children: [
        { component: 'text', content: 'L' },
        { component: 'spacer', flex: 1 },
        { component: 'text', content: 'R' },
      ] },
      { width: 10, height: 1 },
    );
    expect(t.line(0)).toBe('L        R');

    t.resize(6, 1);
    expect(t.line(0)).toBe('L    R');
    await t.unmount();
  });

  it('degrades glyphs when unicode is unavailable', async () => {
    const t = await render(
      { component: 'box', border: 'single', width: 6, height: 3 },
      { width: 10, height: 3 },
    );
    expect(t.line(0)).toBe('┌────┐');

    t.setCapabilities({ unicode: 'ascii' });
    expect(t.line(0)).toBe('+----+');
    await t.unmount();
  });

  it('publishes size and capabilities into the store', async () => {
    const t = await render({ component: 'text', content: 'x' }, { width: 42, height: 7 });
    expect(t.store.get('$/modus/size')).toEqual({ width: 42, height: 7 });
    expect(t.store.get('$/modus/class')).toBe('narrow');
    await t.unmount();
  });
});

describe('animation time', () => {
  it('advances a spinner only when time moves', async () => {
    const t = await render({ component: 'Spinner', label: 'working' }, { width: 30, height: 2 });
    const first = t.line(0);
    expect(t.line(0)).toBe(first);

    t.advance(500);
    expect(t.hasText('working')).toBe(true);
    await t.unmount();
  });
});

describe('snapshots', () => {
  it('produces a stable text snapshot', async () => {
    const t = await render(
      { component: 'box', border: 'single', title: 'ok', width: 12, height: 3 },
      { width: 12, height: 3 },
    );
    expect(snapshot(t)).toBe(['┌ ok ──────┐', '│          │', '└──────────┘'].join('\n'));
    await t.unmount();
  });

  it('adds a ruler when asked', async () => {
    const t = await render({ component: 'text', content: 'abc' }, { width: 5, height: 1 });
    const snap = snapshot(t, { ruler: true });
    expect(snap.split('\n')[1]).toBe('012');
    await t.unmount();
  });
});
