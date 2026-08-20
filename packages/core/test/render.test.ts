import { describe, expect, it } from 'vitest';
import { render, renderToString } from '../src/render/static.js';
import { h, defineComponent, toSerializable } from '../src/jsx/factory.js';
import type { ComponentNode } from '../src/types/graph.js';
import { stringWidth } from '../src/util/text.js';

describe('text', () => {
  it('renders a bare string', () => {
    expect(renderToString({ component: 'text', content: 'hello' }, { width: 20 })).toBe('hello');
  });

  it('renders children as content', () => {
    expect(renderToString(h('text', null, 'hello'), { width: 20 })).toBe('hello');
  });

  it('truncates to the width it was given', () => {
    const out = renderToString(
      { component: 'text', content: 'abcdefghij', width: 5 },
      { width: 20 },
    );
    expect(out).toBe('abcd…');
  });

  it('wraps when asked', () => {
    const out = renderToString(
      { component: 'text', content: 'the quick brown fox', wrap: 'word', width: 10 },
      { width: 20 },
    );
    expect(out).toBe('the quick\nbrown fox');
  });

  it('aligns within its box', () => {
    const out = renderToString(
      { component: 'box', width: 9, children: { component: 'text', content: 'ab', textAlign: 'center' } },
      { width: 20 },
    );
    expect(out).toBe('   ab');
  });
});

describe('box', () => {
  it('draws a single border', () => {
    const out = renderToString(
      { component: 'box', border: 'single', width: 6, height: 3 },
      { width: 20, height: 3 },
    );
    expect(out).toBe(['┌────┐', '│    │', '└────┘'].join('\n'));
  });

  it('draws a rounded border', () => {
    const out = renderToString(
      { component: 'box', border: 'round', width: 4, height: 3 },
      { width: 20, height: 3 },
    );
    expect(out.split('\n')[0]).toBe('╭──╮');
    expect(out.split('\n')[2]).toBe('╰──╯');
  });

  it('puts a title into the top border', () => {
    const out = renderToString(
      { component: 'box', border: 'single', title: 'Services', width: 20, height: 3 },
      { width: 20, height: 3 },
    );
    expect(out.split('\n')[0]).toBe('┌ Services ────────┐');
  });

  it('centres a title', () => {
    const out = renderToString(
      { component: 'box', border: 'single', title: 'x', titleAlign: 'center', width: 9, height: 3 },
      { width: 20, height: 3 },
    );
    expect(out.split('\n')[0]).toBe('┌── x ──┐');
  });

  it('puts a footer into the bottom border', () => {
    const out = renderToString(
      { component: 'box', border: 'single', footer: 'q quit', width: 16, height: 3 },
      { width: 20, height: 3 },
    );
    expect(out.split('\n')[2]).toBe('└ q quit ──────┘');
  });

  it('insets its children by border and padding', () => {
    const out = renderToString(
      {
        component: 'box',
        border: 'single',
        padding: 1,
        width: 11,
        height: 5,
        children: { component: 'text', content: 'hi' },
      },
      { width: 20, height: 5 },
    );
    expect(out.split('\n')[2]).toBe('│ hi      │');
  });

  it('lays a row out left to right', () => {
    const out = renderToString(
      {
        component: 'box',
        direction: 'row',
        gap: 1,
        children: [
          { component: 'text', content: 'aa' },
          { component: 'text', content: 'bb' },
        ],
      },
      { width: 20, height: 1 },
    );
    expect(out).toBe('aa bb');
  });

  it('pushes a child to the right with a flex spacer', () => {
    const out = renderToString(
      {
        component: 'box',
        direction: 'row',
        width: 10,
        children: [
          { component: 'text', content: 'L' },
          { component: 'spacer', flex: 1 },
          { component: 'text', content: 'R' },
        ],
      },
      { width: 10, height: 1 },
    );
    expect(out).toBe('L        R');
  });
});

describe('function components', () => {
  it('renders a function component', () => {
    const Greeting = defineComponent<{ name: string }>('Greeting', ({ name }) =>
      h('text', { content: `hello ${name}` }),
    );
    expect(renderToString(h(Greeting, { name: 'softov' }), { width: 30 })).toBe('hello softov');
  });

  it('is transparent to layout', () => {
    const Row = defineComponent<{ children?: unknown }>('Row', ({ children }) =>
      h('box', { direction: 'row', gap: 1 }, children),
    );
    const out = renderToString(
      h(Row, null, h('text', { content: 'a' }), h('text', { content: 'b' })),
      { width: 20, height: 1 },
    );
    expect(out).toBe('a b');
  });

  it('composes nested function components', () => {
    const Label = defineComponent<{ text: string }>('Label', ({ text }) =>
      h('text', { content: text, bold: true }),
    );
    const Card = defineComponent<{ title: string }>('Card', ({ title }) =>
      h('box', { border: 'single', width: 12, height: 3, padding: { left: 1 } },
        h(Label, { text: title })),
    );
    const out = renderToString(h(Card, { title: 'ok' }), { width: 20, height: 3 });
    expect(out.split('\n')[1]).toBe('│ ok       │');
  });

  it('renders a fallback instead of dying when a component throws', () => {
    const Broken = defineComponent('Broken', () => {
      throw new Error('nope');
    });
    const out = renderToString(
      h('box', null, h(Broken, {}), h('text', { content: 'still here' })),
      { width: 40, height: 3, onError: () => {} },
    );
    expect(out).toContain('nope');
    expect(out).toContain('still here');
  });
});

describe('JSX and data are the same value', () => {
  it('produces an identical node', () => {
    const fromH = h('box', { gap: 1, direction: 'row' });
    const fromData: ComponentNode = { component: 'box', gap: 1, direction: 'row' };
    expect(fromH).toEqual(fromData);
  });

  it('renders identically either way', () => {
    const opts = { width: 20, height: 3 };
    const built = h('box', { border: 'single', width: 8, height: 3, title: 'x' });
    const data: ComponentNode = {
      component: 'box', border: 'single', width: 8, height: 3, title: 'x',
    };
    expect(renderToString(built, opts)).toBe(renderToString(data, opts));
  });

  it('strips closures when a node is serialized', () => {
    const node = h('box', { onClick: () => {}, gap: 1 });
    const clean = toSerializable(node);
    expect(clean).toEqual({ component: 'box', gap: 1 });
    expect(JSON.parse(JSON.stringify(clean))).toEqual(clean);
  });

  it('round-trips a function component node through JSON as its name', () => {
    const Widget = defineComponent('Widget', () => h('text', { content: 'w' }));
    const node = h(Widget, {});
    expect(node.component).toBe('Widget');
    expect(toSerializable(node)).toEqual({ component: 'Widget' });
  });
});

describe('store-bound props', () => {
  it('resolves a binding to a store path', () => {
    const out = renderToString(
      { component: 'text', content: { path: '$/statusbar/agent/name' } },
      { width: 30, initialState: { '$/statusbar/agent/name': 'billing-worker' } },
    );
    expect(out).toBe('billing-worker');
  });

  it('renders one instance per item from a templated child list', () => {
    const out = renderToString(
      {
        component: 'box',
        children: {
          template: { component: 'text', content: { path: '/name' } },
          path: '$/services/list',
        },
      },
      {
        width: 30,
        initialState: {
          '$/services/list': [{ name: 'api' }, { name: 'auth' }, { name: 'mailer' }],
        },
      },
    );
    expect(out).toBe('api\nauth\nmailer');
  });

  it('resolves relative paths against each row context', () => {
    const out = renderToString(
      {
        component: 'box',
        children: {
          template: {
            component: 'box',
            direction: 'row',
            gap: 1,
            children: [
              { component: 'text', content: { path: '/name' } },
              { component: 'text', content: { path: '/status' } },
            ],
          },
          path: '$/services/list',
        },
      },
      {
        width: 30,
        initialState: {
          '$/services/list': [
            { name: 'api', status: 'up' },
            { name: 'mailer', status: 'down' },
          ],
        },
      },
    );
    expect(out).toBe('api up\nmailer down');
  });
});

describe('missing components', () => {
  it('renders the miss visibly rather than silently', () => {
    const out = renderToString({ component: 'NotRegistered' }, { width: 30 });
    expect(out).toBe('<NotRegistered>');
  });

  it('uses a declared fallback instead', () => {
    const out = renderToString(
      { component: 'NotRegistered', $meta: { fallback: { component: 'text', content: 'n/a' } } },
      { width: 30 },
    );
    expect(out).toBe('n/a');
  });
});

describe('auto height', () => {
  it('sizes the buffer to the content', () => {
    const result = render(
      { component: 'box', children: [
        { component: 'text', content: 'a' },
        { component: 'text', content: 'b' },
      ] },
      { width: 10 },
    );
    expect(result.buffer.height).toBe(2);
    result.dispose();
  });
});

describe('wide characters', () => {
  it('lays out CJK by cell width, not code point count', () => {
    const out = renderToString(
      {
        component: 'box',
        direction: 'row',
        gap: 1,
        children: [
          { component: 'text', content: '日本' },
          { component: 'text', content: 'x' },
        ],
      },
      { width: 20, height: 1 },
    );
    expect(out).toBe('日本 x');
    expect(stringWidth(out)).toBe(6);
  });
});
