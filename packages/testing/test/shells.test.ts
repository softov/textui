import { describe, expect, it } from 'vitest';
import { renderApp } from '../src/index.js';
import { h, defineComponent, useFocus, useScreen } from '@textui/core';
import { registerBuiltins } from '@textui/widgets';

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

/**
 * A screen has to be *on screen*.
 *
 * The stack kept its own books correctly for a long time while nothing
 * mounted what was on top of it - every test asserted `current()?.id` and
 * none asserted that anything had been drawn. So these read the frame.
 */
describe('navigation', () => {
  const Detail = defineComponent<{ taskId?: string }>('Detail', (props) => {
    const screen = useScreen<{ taskId?: string }>();
    const focus = useFocus({});
    return h('text', {
      id: focus.id,
      content: `DETAIL prop=${props.taskId ?? '-'} hook=${screen.params.taskId ?? '-'}`,
    });
  });

  const stacked = async (options: { surface?: string } = {}) => {
    const t = await renderApp({
      shell: 'plain',
      onBoot: (app) => {
        app.components.register({ component: 'Detail', renderer: { kind: 'function', render: Detail } });
        app.screens.register({ id: 'home', component: { component: 'text', content: 'HOME-SCREEN' } });
        app.screens.register({
          id: 'detail',
          component: 'Detail',
          ...(options.surface ? { surface: options.surface } : {}),
        });
        app.screens.reset('home');
      },
    });
    await t.settle();
    return t;
  };

  it('draws the screen on top of the stack', async () => {
    const t = await stacked();
    expect(t.hasText('HOME-SCREEN')).toBe(true);

    t.app.screens.push('detail');
    await t.settle();

    // Swapped, not stacked: only the top is mounted.
    expect(t.hasText('DETAIL')).toBe(true);
    expect(t.hasText('HOME-SCREEN')).toBe(false);

    t.app.screens.pop();
    await t.settle();
    expect(t.hasText('HOME-SCREEN')).toBe(true);
    expect(t.hasText('DETAIL')).toBe(false);
    await t.unmount();
  });

  it('hands the parameters over as props and publishes them too', async () => {
    const t = await stacked();
    t.app.screens.push('detail', { taskId: 'abc' });
    await t.settle();

    // Both, because a screen's own signature is the readable way to take an
    // id and the store is the only way to read it eight levels down.
    expect(t.hasText('prop=abc')).toBe(true);
    expect(t.hasText('hook=abc')).toBe(true);
    expect(t.store.get('$/layout/screen/params')).toEqual({ taskId: 'abc' });
    await t.unmount();
  });

  it('gives each screen its own focus scope', async () => {
    const t = await stacked();
    t.app.screens.push('detail', { taskId: 'abc' });
    await t.settle();

    // Whatever the screen focuses belongs to the screen, so the stack can put
    // focus back rather than guessing at an id that outlived its component.
    const inside = t.app.focus.order('screen:detail');
    expect(inside).toHaveLength(1);
    expect(t.app.focus.scopeOf(inside[0] as string)).toBe('screen:detail');

    // And it goes with the screen: pop, and the scope holds nothing.
    t.app.screens.pop();
    await t.settle();
    expect(t.app.focus.order('screen:detail')).toEqual([]);
    await t.unmount();
  });

  it('mounts a screen into the surface it names', async () => {
    const t = await stacked({ surface: 'sidebar' });
    t.app.screens.push('detail');
    await t.settle();

    // A surface is the application's word. A screen that wants to be a panel
    // says so, and nothing here has to know what `sidebar` means.
    expect(t.app.surfaces.mounts('sidebar').some((m) => m.key.includes('detail'))).toBe(true);
    expect(t.app.surfaces.mounts('main').some((m) => m.key.includes('detail'))).toBe(false);
    await t.unmount();
  });

  it('takes focus when it arrives', async () => {
    const t = await stacked();
    t.app.focus.blur();
    await t.settle();

    t.app.screens.push('detail', { taskId: 'abc' });
    await t.settle();

    // Pushing a screen unmounts whatever held focus. Without this the new
    // screen is one no key reaches, and what it shows cannot be scrolled.
    const focused = t.app.focus.focused();
    expect(focused).not.toBeNull();
    expect(t.app.focus.scopeOf(focused as string)).toBe('screen:detail');
    await t.unmount();
  });

  it('replaces the top without growing the stack', async () => {
    const t = await stacked();
    t.app.screens.replace('detail');
    await t.settle();

    expect(t.hasText('DETAIL')).toBe(true);
    expect(t.app.screens.stack()).toHaveLength(1);
    expect(t.app.screens.canGoBack()).toBe(false);
    await t.unmount();
  });

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

/**
 * Regions, and what they cost when they are empty.
 *
 * Both of these were found by an application rather than by a test: a sidebar
 * nobody mounted still reserved its column, and a sidebar with one panel in it
 * got a rule underneath separating it from nothing.
 */
describe('empty and single-mount regions', () => {
  // A layout checked at one size is a layout that breaks at the second.
  const SIZES = [
    { width: 96, height: 16 },
    { width: 140, height: 40 },
  ];

  for (const size of SIZES) {
    const at = `${size.width}x${size.height}`;

    it(`spends no width on a sidebar nothing is mounted on, at ${at}`, async () => {
      const t = await renderApp({
        ...size,
        shell: 'workbench',
        onBoot: (app) => {
          app.open({ surface: 'main', key: 'm', target: { component: 'text', content: 'MAIN' } });
        },
      });
      await t.settle();

      const row = t.lines().find((l) => l.includes('MAIN'));
      // Inside the frame and its padding, and nowhere near column 24.
      expect(row?.indexOf('MAIN')).toBeLessThan(4);
      await t.unmount();
    });

    // `aside`, not `sidebar`: the sidebar shows one panel at a time now, and
    // these two are about what a *stacked* surface draws between its mounts.
    it(`draws no rule under a single stacked mount, at ${at}`, async () => {
      const t = await renderApp({
        ...size,
        shell: 'workbench',
        onBoot: (app) => {
          app.store.set('$/ui/aside/visible', true);
          app.open({ surface: 'aside', key: 's', target: { component: 'text', content: 'ONLY' } });
          app.open({ surface: 'main', key: 'm', target: { component: 'text', content: 'MAIN' } });
        },
      });
      await t.settle();

      const index = t.lines().findIndex((l) => l.includes('ONLY'));
      expect(index).toBeGreaterThanOrEqual(0);
      // The row under the only mount belongs to nobody, so it stays blank.
      const under = t.lines()[index + 1] ?? '';
      expect(under).not.toMatch(/[─━]{4,}/);
      await t.unmount();
    });

    it(`still rules between two stacked mounts, at ${at}`, async () => {
      const t = await renderApp({
        ...size,
        shell: 'workbench',
        onBoot: (app) => {
          app.store.set('$/ui/aside/visible', true);
          app.open({ surface: 'aside', key: 'a', target: { component: 'text', content: 'FIRST' } });
          app.open({ surface: 'aside', key: 'b', target: { component: 'text', content: 'SECOND' } });
          app.open({ surface: 'main', key: 'm', target: { component: 'text', content: 'MAIN' } });
        },
      });
      await t.settle();

      // Stacked mounts share the surface rather than each taking only the
      // height of its own content, so the rule sits at the boundary between
      // the two shares - somewhere between the labels, not pinned under the
      // first line of text.
      const first = t.lines().findIndex((l) => l.includes('FIRST'));
      const second = t.lines().findIndex((l) => l.includes('SECOND'));
      expect(first).toBeGreaterThanOrEqual(0);
      expect(second).toBeGreaterThan(first);
      const between = t.lines().slice(first + 1, second);
      expect(between.some((l) => /[─━]{4,}/.test(l)), 'a rule should separate the two mounts').toBe(true);
      await t.unmount();
    });
  }
});

describe('surfaces are the application\'s vocabulary', () => {
  /**
   * A surface name is not a library constraint.
   *
   * `SurfaceName` lists the names the shipped shells use so an editor can
   * complete them, and nothing more: the type stays open and the runtime never
   * checks one. An application that wants `lateral1` and `lateral2` says so
   * and mounts onto them.
   */
  it('accepts a name the library has never heard of', async () => {
    const t = await renderApp({
      width: 60, height: 12,
      onBoot: (app) => {
        app.open({ surface: 'lateral1', key: 'a', target: { component: 'text', content: 'ONE' } });
        app.open({ surface: 'inspector', key: 'b', target: { component: 'text', content: 'TWO' } });
      },
    });
    await t.settle();

    // Default state on first use, so no reader has to handle a hole.
    expect(t.app.surfaces.state('lateral1')).toMatchObject({ visible: true, layout: 'single' });
    expect(t.app.surfaces.mounts('lateral1')).toHaveLength(1);
    expect(t.app.surfaces.mounts('inspector')).toHaveLength(1);

    // `single` is the fallback: a surface the library has never seen cannot be
    // assumed to want tabs.
    expect(t.app.surfaces.state('inspector').layout).toBe('single');

    t.app.surfaces.setState('lateral2', { visible: false });
    expect(t.app.surfaces.state('lateral2')).toMatchObject({ visible: false, layout: 'single' });
    await t.unmount();
  });
});

/**
 * The sidebar shows one panel at a time.
 *
 * A second panel arriving under the first halves both of them, and a sidebar
 * is a narrow column where a tree, a source control list and a search each
 * want the whole height. Which one is showing is `activeKey`, and the heading
 * is the only thing that answers "which one am I looking at".
 */
describe('the sidebar with more than one panel in it', () => {
  // A layout checked at one size is a layout that breaks at the second.
  const SIZES = [
    { width: 96, height: 16 },
    { width: 140, height: 40 },
  ];

  for (const size of SIZES) {
    const at = `${size.width}x${size.height}`;

    const open = async () => {
      const t = await renderApp({
        ...size,
        shell: 'workbench',
        onBoot: (app) => {
          app.open({
            surface: 'sidebar', key: 'tree',
            target: { component: 'text', content: 'THE-TREE' },
            display: { title: 'Explorer' },
          });
          app.open({
            surface: 'sidebar', key: 'scm',
            target: { component: 'text', content: 'THE-CHANGES' },
            display: { title: 'Source Control' },
          });
          app.open({ surface: 'main', key: 'm', target: { component: 'text', content: 'MAIN' } });
        },
      });
      await t.settle();
      return t;
    };

    it(`shows the first one and not the second, at ${at}`, async () => {
      const t = await open();
      expect(t.hasText('THE-TREE')).toBe(true);
      expect(t.hasText('THE-CHANGES'), 'the second must not stack under it').toBe(false);
      await t.unmount();
    });

    it(`names the panel it is showing, at ${at}`, async () => {
      const t = await open();
      expect(t.hasText('Explorer')).toBe(true);
      await t.unmount();
    });

    it(`swaps to the other one, and only the other one, at ${at}`, async () => {
      const t = await open();
      t.app.surfaces.activate('sidebar', 'scm');
      await t.settle();

      expect(t.hasText('THE-CHANGES')).toBe(true);
      expect(t.hasText('THE-TREE')).toBe(false);
      expect(t.hasText('Source Control'), 'and says which it swapped to').toBe(true);
      await t.unmount();
    });
  }
});

/**
 * `root` is a mount, and both ways it reaches the screen have to agree.
 *
 * With a shell registered it is opened into `main` and the surface registry
 * owns it. With no shell at all - which is every application built out of
 * primitives - `rootNode` wraps it directly and the registry is never
 * consulted. `setRoot` has always handled both, and says why: setting one and
 * not the other works in exactly half of the programs that can exist.
 *
 * `setShell` is the moment a program crosses from the second case to the
 * first, and it did not.
 */
describe('a shell that arrives after boot', () => {
  it('keeps what root was drawing', async () => {
    const t = await renderApp({
      width: 40, height: 6,
      // No shell at boot: the harness registers the built-ins, shells and all,
      // unless told not to.
      builtins: false,
      root: h('text', { content: 'THE-APPLICATION' }),
    });
    await t.settle();
    expect(t.hasText('THE-APPLICATION')).toBe(true);

    registerBuiltins(t.app);
    t.app.setShell('workbench');
    for (let i = 0; i < 4; i++) await t.settle();

    // It used to be a framed, themed, empty screen: `rootNode` started
    // answering with the shell, and nothing had ever put `root` into `main`.
    expect(t.hasText('THE-APPLICATION')).toBe(true);
    await t.unmount();
  });

  it('does not stack a second mount when the shell changes again', async () => {
    const t = await renderApp({
      width: 40, height: 6,
      builtins: false,
      root: h('text', { content: 'ONCE' }),
    });
    registerBuiltins(t.app);
    t.app.setShell('workbench');
    t.app.setShell('plain');
    t.app.setShell('workbench');
    for (let i = 0; i < 4; i++) await t.settle();

    // Opening the same key replaces the mount rather than stacking one, so the
    // surface never grows a tab strip out of the same node three times over.
    const lines = t.lines().join('\n');
    expect(lines.split('ONCE')).toHaveLength(2);
    await t.unmount();
  });
});

/**
 * The sidebar is a decision about the window, not a column of the document.
 *
 * Sideways, the layout shrinks a child with a plain `width` before it clips
 * anything - which is how terminals have always narrowed, and is right for
 * content. Applied to chrome it meant a pane with a long line in it could
 * crush twenty-four columns of file tree down to four.
 */
describe('the sidebar holds its width', () => {
  it('is not crushed by an overflowing pane beside it', async () => {
    // Ninety columns or the shell hides the sidebar as too narrow to be worth
    // the space, and the test would pass by drawing nothing.
    const t = await renderApp({ width: 100, height: 6, shell: 'workbench' });
    t.app.open({
      surface: 'sidebar', key: 'tree',
      target: { component: 'text', content: 'S'.repeat(24), wrap: 'none' },
    });
    // The pane beside it, with a line four hundred columns long in it.
    t.app.open({
      surface: 'main', key: 'wide',
      target: { component: 'text', content: 'M'.repeat(400), wrap: 'none' },
    });
    for (let i = 0; i < 4; i++) await t.settle();

    const row = t.lines().find((line) => line.includes('S')) ?? '';
    expect(row).toContain('S'.repeat(20));
    await t.unmount();
  });
});
