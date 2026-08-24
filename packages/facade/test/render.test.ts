import { describe, expect, it } from 'vitest';
import { createVirtualTerminal } from '@textui/terminal';
import { h, useEffect } from '@textui/core';
import { render } from '../src/render.js';

// Frames are coalesced at the animation driver's ceiling - 30fps by default,
// so a frame is ~33ms away. Waiting less than one frame tests nothing.
const settle = (): Promise<void> => new Promise((r) => setTimeout(r, 120));

const App = (props: { label?: string }) =>
  h('box', { border: 'single', padding: 1 }, h('text', { content: props.label ?? 'hello' }));

// Two sizes, because one fixed size never meets a breakpoint.
for (const size of [{ width: 40, height: 7 }, { width: 24, height: 5 }]) {
  describe(`render at ${size.width}x${size.height}`, () => {
    it('mounts and paints without being awaited', async () => {
      const terminal = createVirtualTerminal(size);
      const app = render(h(App, {}), { terminal });
      await settle();
      expect(terminal.output()).toContain('hello');
      await app.unmount();
    });

    it('rerender swaps the root', async () => {
      const terminal = createVirtualTerminal(size);
      const app = render(h(App, {}), { terminal });
      await settle();
      app.rerender(h(App, { label: 'again' }));
      await settle();
      expect(terminal.output()).toContain('again');
      await app.unmount();
    });
  });
}

describe('leaving', () => {
  it('waitUntilExit resolves on unmount', async () => {
    const terminal = createVirtualTerminal({ width: 30, height: 5 });
    const app = render(h(App, {}), { terminal });
    await settle();

    let exited = false;
    const waiting = app.waitUntilExit().then(() => { exited = true; });
    expect(exited).toBe(false);

    await app.unmount();
    await waiting;
    expect(exited).toBe(true);
  });

  // In raw mode ctrl+c is the byte 0x03, not SIGINT, so the process signal
  // handlers never see it. Without this an application cannot be quit from
  // the keyboard at all - which is what a plain `createApp` was.
  it('ctrl+c unmounts', async () => {
    const terminal = createVirtualTerminal({ width: 30, height: 5 });
    const app = render(h(App, {}), { terminal });
    await settle();

    terminal.feed('\x03');
    await app.waitUntilExit();
    expect(true).toBe(true);
  });

  it('leaves ctrl+c alone when asked to', async () => {
    const terminal = createVirtualTerminal({ width: 30, height: 5 });
    const app = render(h(App, {}), { terminal, exitOnCtrlC: false });
    await settle();

    let exited = false;
    void app.waitUntilExit().then(() => { exited = true; });
    terminal.feed('\x03');
    await settle();
    expect(exited).toBe(false);

    await app.unmount();
  });

  it('unmounting twice is one stop', async () => {
    const terminal = createVirtualTerminal({ width: 30, height: 5 });
    const app = render(h(App, {}), { terminal });
    await settle();
    await Promise.all([app.unmount(), app.unmount()]);
    await app.waitUntilExit();
  });
});

// A cleanup that logs is a real debugging need, and it used to fail silently:
// `stop` disposed the tree while the alternate screen was still up, so
// anything a cleanup printed went into a buffer the terminal throws away on
// its way out. Releasing first means the screen is back before any cleanup
// runs, and a `console.log` in one lands where a person can read it.
describe('the order of leaving', () => {
  it('gives the terminal back before it disposes the tree', async () => {
    const order: string[] = [];
    const terminal = createVirtualTerminal({ width: 30, height: 5 });
    const release = terminal.release.bind(terminal);
    terminal.release = () => { order.push('release'); release(); };

    const Logs = () => {
      useEffect(() => () => { order.push('cleanup'); }, []);
      return h('text', { content: 'x' });
    };

    const app = render(h(Logs, {}), { terminal });
    await settle();
    await app.unmount();

    expect(order).toEqual(['release', 'cleanup']);
  });
});
