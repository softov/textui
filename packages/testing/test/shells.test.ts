import { describe, expect, it } from 'vitest';
import { renderApp } from '../src/index.js';
import { h, defineComponent } from '@textui/core';

/**
 * The acceptance test for the whole architecture.
 *
 * One component, mounted once, rendered by three different shells with three
 * different themes. If any of them needed a component the others could not
 * use, the boundary between shell and catalog would be in the wrong place.
 */

const SERVICES = [
  { id: 'api', name: 'api-gateway', status: 'up', cpu: '12.4%' },
  { id: 'billing', name: 'billing-worker', status: 'degraded', cpu: '48.9%' },
  { id: 'mailer', name: 'mailer', status: 'down', cpu: '0.0%' },
];

const ServiceTable = defineComponent('ServiceTable', () =>
  h('Table', {
    columns: [
      { key: 'name', header: 'NAME', width: 16 },
      { key: 'status', header: 'STATUS', width: 9 },
      { key: 'cpu', header: 'CPU', width: 6, align: 'right', priority: 1 },
    ],
    rows: SERVICES,
  }),
);

async function mountIn(shell: string) {
  return renderApp({
    width: 90,
    height: 20,
    shell,
    onBoot: (app) => {
      app.open({ surface: 'main', key: 'services', target: h(ServiceTable, {}), display: { title: 'Services' } });
      app.open({ surface: 'status', key: 'hints', target: { component: 'KeyHints', hints: [{ keys: 'q', label: 'quit' }] } });
      app.open({ surface: 'header', key: 'title', target: { component: 'text', content: 'TextUI' } });
    },
  });
}

describe('one component, three shells', () => {
  for (const shell of ['console', 'paper', 'workbench']) {
    it(`renders the same table under the ${shell} shell`, async () => {
      const t = await mountIn(shell);
      expect(t.hasText('api-gateway')).toBe(true);
      expect(t.hasText('billing-worker')).toBe(true);
      expect(t.hasText('NAME')).toBe(true);
      expect(t.getByRole('table')).toBeDefined();
      await t.unmount();
    });
  }

  it('renders differently under each shell', async () => {
    const outputs: string[] = [];
    for (const shell of ['console', 'paper', 'workbench']) {
      const t = await mountIn(shell);
      outputs.push(t.text());
      await t.unmount();
    }
    expect(new Set(outputs).size).toBe(3);
  });

  it('switches shell at runtime without remounting the app', async () => {
    const t = await mountIn('console');
    const before = t.text();
    expect(t.hasText('api-gateway')).toBe(true);

    t.setShell('workbench');
    expect(t.app.activeShell()).toBe('workbench');
    expect(t.hasText('api-gateway')).toBe(true);
    expect(t.text()).not.toBe(before);
    await t.unmount();
  });

  it('a shell picks up its own theme', async () => {
    const t = await mountIn('paper');
    expect(t.store.get('$/modus/theme')).toBe('paper');
    await t.unmount();
  });

  it('only offers shells that fit the terminal', async () => {
    const t = await renderApp({ width: 90, height: 20 });
    const wide = t.app.shells.suitable(90, 20).map((s) => s.id);
    const narrow = t.app.shells.suitable(40, 8).map((s) => s.id);

    expect(wide).toContain('workbench');
    expect(narrow).not.toContain('workbench');
    expect(narrow).toContain('plain');
    await t.unmount();
  });
});

describe('surfaces and mounts', () => {
  it('renders nothing for an empty surface', async () => {
    const t = await renderApp({ shell: 'console', width: 60, height: 10 });
    expect(t.text().trim()).toBe('');
    await t.unmount();
  });

  it('shows a mount and removes it on dispose', async () => {
    const t = await renderApp({ shell: 'plain', width: 40, height: 6 });

    const mount = t.app.open({
      surface: 'main',
      key: 'hello',
      target: { component: 'text', content: 'mounted' },
    });
    t.flush();
    expect(t.hasText('mounted')).toBe(true);

    mount.dispose();
    t.flush();
    expect(t.hasText('mounted')).toBe(false);
    await t.unmount();
  });

  it('hides a mount whose when clause is false', async () => {
    const t = await renderApp({
      shell: 'plain',
      width: 40,
      height: 6,
      initialState: { '$/session/role': 'guest' },
      onBoot: (app) => {
        app.open({
          surface: 'main',
          key: 'admin',
          when: "$/session/role == 'admin'",
          target: { component: 'text', content: 'admin only' },
        });
      },
    });
    expect(t.hasText('admin only')).toBe(false);

    t.store.set('$/session/role', 'admin');
    t.flush();
    expect(t.hasText('admin only')).toBe(true);
    await t.unmount();
  });

  it('shows a tab strip once a surface has two mounts', async () => {
    const t = await renderApp({
      shell: 'plain',
      width: 50,
      height: 8,
      onBoot: (app) => {
        app.surfaces.setState('main', { layout: 'tabs' });
        app.open({ surface: 'main', key: 'a', target: { component: 'text', content: 'first' }, display: { title: 'One' } });
      },
    });
    expect(t.hasText('One')).toBe(false);

    t.app.open({ surface: 'main', key: 'b', target: { component: 'text', content: 'second' }, display: { title: 'Two' } });
    t.flush();
    expect(t.hasText('One')).toBe(true);
    expect(t.hasText('Two')).toBe(true);
    await t.unmount();
  });

  it('switches a surface layout at runtime, because it is store state', async () => {
    const t = await renderApp({
      shell: 'plain',
      width: 50,
      height: 10,
      onBoot: (app) => {
        app.surfaces.setState('main', { layout: 'tabs' });
        app.open({ surface: 'main', key: 'a', target: { component: 'text', content: 'first' }, display: { title: 'One' } });
        app.open({ surface: 'main', key: 'b', target: { component: 'text', content: 'second' }, display: { title: 'Two' } });
      },
    });
    // Tabs: only the active mount's body shows.
    expect(t.hasText('first')).toBe(true);
    expect(t.hasText('second')).toBe(false);

    t.app.surfaces.setState('main', { layout: 'stack' });
    t.flush();
    expect(t.hasText('first')).toBe(true);
    expect(t.hasText('second')).toBe(true);
    await t.unmount();
  });

  it('activates another tab', async () => {
    const t = await renderApp({
      shell: 'plain',
      width: 50,
      height: 8,
      onBoot: (app) => {
        app.surfaces.setState('main', { layout: 'tabs' });
        app.open({ surface: 'main', key: 'a', target: { component: 'text', content: 'first' }, display: { title: 'One' } });
        app.open({ surface: 'main', key: 'b', target: { component: 'text', content: 'second' }, display: { title: 'Two' } });
      },
    });
    t.app.surfaces.activate('main', 'b');
    t.flush();
    expect(t.hasText('second')).toBe(true);
    await t.unmount();
  });
});

describe('navigation', () => {
  it('pushes and pops screens', async () => {
    const t = await renderApp({
      shell: 'plain',
      onBoot: (app) => {
        app.screens.register({ id: 'home', component: { component: 'text', content: 'home' } });
        app.screens.register({ id: 'detail', component: { component: 'text', content: 'detail' } });
        app.screens.reset('home');
      },
    });

    expect(t.app.screens.current()?.id).toBe('home');
    expect(t.app.screens.canGoBack()).toBe(false);

    t.app.screens.push('detail');
    expect(t.app.screens.current()?.id).toBe('detail');
    expect(t.app.screens.canGoBack()).toBe(true);

    expect(t.app.screens.pop()).toBe(true);
    expect(t.app.screens.current()?.id).toBe('home');
    await t.unmount();
  });

  it('refuses to pop the last screen', async () => {
    const t = await renderApp({
      onBoot: (app) => {
        app.screens.register({ id: 'home', component: { component: 'text', content: 'home' } });
        app.screens.reset('home');
      },
    });
    expect(t.app.screens.pop()).toBe(false);
    await t.unmount();
  });

  it('clears a screen scope when it is popped', async () => {
    const t = await renderApp({
      onBoot: (app) => {
        app.screens.register({ id: 'home', component: { component: 'text', content: 'home' } });
        app.screens.register({ id: 'detail', component: { component: 'text', content: 'detail' } });
        app.screens.reset('home');
      },
    });

    t.app.screens.push('detail');
    t.store.set('$/screen.detail/draft', 'unsaved');
    t.app.screens.pop();
    expect(t.store.get('$/screen.detail/draft')).toBeUndefined();
    await t.unmount();
  });
});
