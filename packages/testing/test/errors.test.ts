import { describe, expect, it } from 'vitest';
import { render, renderApp } from '../src/index.js';
import { h, defineComponent } from '@textui/core';
import type { RenderError } from '@textui/core';

/**
 * What a component that throws does to the screen.
 *
 * A throw is contained where it happened: siblings still render and the
 * application stays up, which is why there is no boundary component to
 * remember to wrap things in. What is worth pinning is that the failure is
 * reachable - by the fallback, and by `errors()`.
 */

const Boom = defineComponent<{ why?: string }>('Boom', (props) => {
  throw new Error(props.why ?? 'kaboom');
});

describe('a component that throws', () => {
  it('renders the message in place and leaves its siblings alone', async () => {
    const t = await render(
      h('box', { direction: 'column' },
        h('text', { content: 'above' }),
        h(Boom, {}),
        h('text', { content: 'below' })),
    );
    expect(t.lines().slice(0, 3)).toEqual(['above', 'Boom: kaboom', 'below']);
    expect(t.errors()[0]?.context).toBe('render of <Boom>');
    await t.unmount();
  });

  it('renders a declared node fallback, and hands it the failure as props', async () => {
    const Shown = defineComponent<{ errorMessage?: string }>('Shown', (props) =>
      h('text', { content: `caught: ${props.errorMessage ?? ''}` }));

    const t = await render({
      component: 'Boom',
      why: 'disk on fire',
      $meta: { fn: Boom, fallback: { component: 'Shown' } },
    }, { components: [{ component: 'Shown', renderer: { kind: 'function', render: Shown } }] });

    expect(t.lines()[0]).toBe('caught: disk on fire');
    await t.unmount();
  });

  it('renders a function fallback, which receives the error itself', async () => {
    const seen: RenderError[] = [];
    const t = await render({
      component: 'Boom',
      why: 'disk on fire',
      $meta: {
        fn: Boom,
        fallback: (failure: RenderError) => {
          seen.push(failure);
          return { component: 'text', content: `${failure.component} failed: ${failure.message}` };
        },
      },
    });

    expect(t.lines()[0]).toBe('Boom failed: disk on fire');
    expect(seen[0]?.error).toBeInstanceOf(Error);
    expect(seen[0]?.component).toBe('Boom');
    await t.unmount();
  });

  it('lets a fallback declare props of its own, which win', async () => {
    const t = await render({
      component: 'Boom',
      $meta: { fn: Boom, fallback: { component: 'text', content: 'unavailable', errorMessage: 'hidden' } },
    });
    expect(t.lines()[0]).toBe('unavailable');
    await t.unmount();
  });

  it('answers a missing component with the same fallback', async () => {
    const t = await render({
      component: 'NoSuchThing',
      $meta: { fallback: (failure: RenderError) => ({ component: 'text', content: failure.message }) },
    });
    expect(t.lines()[0]).toBe('no component registered as "NoSuchThing"');
    await t.unmount();
  });

  it('keeps the application running after a throw', async () => {
    const t = await render(
      h('box', { direction: 'column' }, h(Boom, {}), h('text', { content: 'still here' })),
    );
    t.resize(60, 10);
    expect(t.hasText('still here')).toBe(true);
    await t.unmount();
  });
});

/**
 * An error thrown while handling a key.
 *
 * The screen is the output, so an uncaught error from a keystroke exits to a
 * shell with a stack trace and no application - a worse answer than any wrong
 * frame. It belongs in the diagnostics with every other error.
 */
describe('a handler that throws', () => {
  it('does not take the process with it', async () => {
    const t = await renderApp({
      diagnostics: true,
      onBoot: (app) => {
        app.commands.register({
          id: 'boom',
          title: 'Boom',
          run: () => { throw new Error('kaboom'); },
        });
        app.keybindings.register({ keys: 'b', commandId: 'boom' });
      },
    });

    expect(() => t.press('b')).not.toThrow();
    await t.settle();

    const errors = t.store.get<{ message: string }[]>('$/modus/diagnostics/errors') ?? [];
    expect(errors.some((e) => e.message.includes('kaboom'))).toBe(true);
    // Still running, still drawing.
    expect(t.app.running).toBe(true);
    await t.unmount();
  });

  it('refuses a command whose required argument is missing, without dying', async () => {
    const t = await renderApp({
      diagnostics: true,
      onBoot: (app) => {
        app.commands.register({
          id: 'named',
          title: 'Named',
          args: [{ name: 'title', type: 'string', required: true }],
          run: () => {},
        });
        app.keybindings.register({ keys: 'k', commandId: 'named' });
      },
    });

    // The refusal is right - the command said it needed one - but it must
    // arrive as a diagnostic rather than as an exit.
    expect(() => t.press('k')).not.toThrow();
    await t.settle();

    const errors = t.store.get<{ message: string }[]>('$/modus/diagnostics/errors') ?? [];
    expect(errors.some((e) => e.message.includes('needs: title'))).toBe(true);
    await t.unmount();
  });
});
