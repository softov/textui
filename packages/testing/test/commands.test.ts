import { describe, expect, it, vi } from 'vitest';
import { renderApp, render } from '../src/index.js';
import { h, defineComponent, useState, filterCommands } from '@textui/core';

describe('commands', () => {
  it('runs a registered command', async () => {
    const run = vi.fn();
    const t = await renderApp({
      onBoot: (app) => {
        app.commands.register({ id: 'test.run', title: 'Run', run });
      },
    });
    await t.app.execute('test.run');
    expect(run).toHaveBeenCalled();
    await t.unmount();
  });

  it('refuses to run a command that was never registered', async () => {
    const t = await renderApp({});
    await expect(t.app.execute('nope')).rejects.toThrow(/no command registered as "nope"/);
    await t.unmount();
  });

  it('honours a when clause', async () => {
    const t = await renderApp({
      initialState: { '$/session/role': 'guest' },
      onBoot: (app) => {
        app.commands.register({
          id: 'admin.wipe', title: 'Wipe', when: "$/session/role == 'admin'", run: () => {},
        });
      },
    });
    expect(t.app.commands.enabled('admin.wipe')).toBe(false);

    t.store.set('$/session/role', 'admin');
    expect(t.app.commands.enabled('admin.wipe')).toBe(true);
    await t.unmount();
  });

  it('rejects a call missing a required argument', async () => {
    const t = await renderApp({
      onBoot: (app) => {
        app.commands.register({
          id: 'svc.restart',
          title: 'Restart',
          args: [{ name: 'service', type: 'string', required: true }],
          run: () => {},
        });
      },
    });
    await expect(t.app.execute('svc.restart')).rejects.toThrow(/needs: service/);
    await t.unmount();
  });

  it('fills in argument defaults', async () => {
    const seen: Record<string, unknown>[] = [];
    const t = await renderApp({
      onBoot: (app) => {
        app.commands.register({
          id: 'svc.scale',
          title: 'Scale',
          args: [{ name: 'replicas', type: 'number', default: 3 }],
          run: (args) => { seen.push(args); },
        });
      },
    });
    await t.app.execute('svc.scale');
    expect(seen[0]).toEqual({ replicas: 3 });
    await t.unmount();
  });
});

describe('keybindings', () => {
  it('runs the bound command', async () => {
    const t = await renderApp({
      onBoot: (app) => {
        app.commands.register({ id: 'ui.toggle', title: 'Toggle', run: () => app.store.set('$/toggled', true) });
        app.keybindings.register({ keys: 'ctrl+b', commandId: 'ui.toggle' });
      },
    });
    t.press('ctrl+b');
    expect(t.store.get('$/toggled')).toBe(true);
    await t.unmount();
  });

  it('waits for the rest of a chord', async () => {
    const t = await renderApp({
      onBoot: (app) => {
        app.commands.register({ id: 'file.save', title: 'Save', run: () => app.store.set('$/saved', true) });
        app.keybindings.register({ keys: 'ctrl+k ctrl+s', commandId: 'file.save' });
      },
    });
    t.press('ctrl+k');
    expect(t.store.get('$/saved')).toBeUndefined();

    t.press('ctrl+s');
    expect(t.store.get('$/saved')).toBe(true);
    await t.unmount();
  });

  it('abandons a chord that does not complete', async () => {
    const t = await renderApp({
      onBoot: (app) => {
        app.commands.register({ id: 'file.save', title: 'Save', run: () => app.store.set('$/saved', true) });
        app.keybindings.register({ keys: 'ctrl+k ctrl+s', commandId: 'file.save' });
      },
    });
    t.press('ctrl+k');
    t.press('x');
    t.press('ctrl+s');
    expect(t.store.get('$/saved')).toBeUndefined();
    await t.unmount();
  });

  it('reports the chords bound to a command', async () => {
    const t = await renderApp({
      onBoot: (app) => {
        app.commands.register({ id: 'app.quit', title: 'Quit', run: () => {} });
        app.keybindings.register({ keys: 'ctrl+q', commandId: 'app.quit' });
        app.keybindings.register({ keys: 'q', commandId: 'app.quit' });
      },
    });
    expect(t.app.keybindings.forCommand('app.quit')).toEqual(['ctrl+q', 'q']);
    await t.unmount();
  });

  it('does not fire while a when clause is false', async () => {
    const t = await renderApp({
      initialState: { '$/ready': false },
      onBoot: (app) => {
        app.commands.register({ id: 'go', title: 'Go', run: () => app.store.set('$/went', true) });
        app.keybindings.register({ keys: 'g', commandId: 'go', when: '$/ready' });
      },
    });
    t.press('g');
    expect(t.store.get('$/went')).toBeUndefined();

    t.store.set('$/ready', true);
    t.press('g');
    expect(t.store.get('$/went')).toBe(true);
    await t.unmount();
  });
});

describe('command palette matching', () => {
  const commands = [
    { id: 'table.search', title: 'Search table', run: () => {} },
    { id: 'app.quit', title: 'Quit', run: () => {} },
    { id: 'navigation.back', title: 'Go back', run: () => {}, keywords: ['previous'] },
  ];

  it('matches a subsequence of the id', () => {
    const found = filterCommands(commands, 'tbs');
    expect(found[0]?.id).toBe('table.search');
  });

  it('prefers an exact prefix', () => {
    const found = filterCommands(commands, 'quit');
    expect(found[0]?.id).toBe('app.quit');
  });

  it('matches keywords', () => {
    const found = filterCommands(commands, 'previous');
    expect(found[0]?.id).toBe('navigation.back');
  });

  it('returns everything for an empty query', () => {
    expect(filterCommands(commands, '')).toHaveLength(3);
  });

  it('returns nothing when nothing matches', () => {
    expect(filterCommands(commands, 'zzzz')).toHaveLength(0);
  });
});

describe('the palette component', () => {
  it('lists commands published to the palette slot', async () => {
    const t = await renderApp({
      width: 60,
      height: 16,
      onBoot: (app) => {
        app.commands.register({ id: 'svc.restart', title: 'Restart service', slots: ['palette'], run: () => {} });
        app.commands.register({ id: 'svc.hidden', title: 'Not in palette', run: () => {} });
        app.open({ surface: 'main', key: 'p', target: { component: 'CommandPalette' } });
      },
    });
    expect(t.hasText('Restart service')).toBe(true);
    expect(t.hasText('Not in palette')).toBe(false);
    await t.unmount();
  });

  it('filters as you type and runs the choice', async () => {
    const ran: string[] = [];
    const t = await renderApp({
      width: 60,
      height: 16,
      onBoot: (app) => {
        app.commands.register({ id: 'svc.restart', title: 'Restart service', slots: ['palette'], run: () => ran.push('restart') });
        app.commands.register({ id: 'svc.scale', title: 'Scale service', slots: ['palette'], run: () => ran.push('scale') });
        // No handler that executes: the palette runs what it finds, which is
        // what makes choosing here and pressing the button the same act.
        app.open({ surface: 'main', key: 'p', target: { component: 'CommandPalette' } });
      },
    });

    t.type('scal');
    expect(t.hasText('Scale service')).toBe(true);
    expect(t.hasText('Restart service')).toBe(false);

    t.press('enter');
    await t.settle();
    expect(ran).toEqual(['scale']);
    await t.unmount();
  });

  /**
   * What a command needs, collected before it runs.
   *
   * "The command declares what it needs and the palette asks" only half held:
   * an argument with `choices` was asked about and anything else was skipped,
   * so a command saying "I need a title" ran with no title. `execute` refuses
   * that - correctly, and loudly - which looked exactly like a broken key.
   */
  const asking = async (args: unknown[], run: (a: Record<string, unknown>) => void) => {
    const t = await renderApp({
      width: 60,
      height: 16,
      onBoot: (app) => {
        app.commands.register({
          id: 'task.new', title: 'New Task', slots: ['palette'],
          args: args as never, run,
        });
        app.open({ surface: 'main', key: 'p', target: { component: 'CommandPalette' } });
      },
    });
    await t.settle();
    return t;
  };

  it('asks for a free-text argument by letting you type it', async () => {
    let got: Record<string, unknown> | null = null;
    const t = await asking(
      [{ name: 'title', type: 'string', required: true, description: 'What needs doing' }],
      (a) => { got = a; },
    );

    t.press('enter');
    await t.settle();
    // Drilled in, not run: the prompt is the argument's description.
    expect(t.hasText('What needs doing')).toBe(true);
    expect(got).toBeNull();

    t.type('Buy milk');
    t.press('enter');
    await t.settle();
    expect(got).toEqual({ title: 'Buy milk' });
    await t.unmount();
  });

  it('will not run it with the answer left empty', async () => {
    let ran = 0;
    const t = await asking(
      [{ name: 'title', type: 'string', required: true }],
      () => { ran++; },
    );

    t.press('enter');
    await t.settle();
    t.press('enter');
    await t.settle();

    // Nothing typed is not an answer, and running anyway hands the command an
    // empty required argument.
    expect(ran).toBe(0);
    await t.unmount();
  });

  it('asks for every argument, not only the first', async () => {
    let got: Record<string, unknown> | null = null;
    const t = await asking(
      [
        { name: 'title', type: 'string', required: true },
        { name: 'priority', type: 'string', choices: ['high', 'low'] },
      ],
      (a) => { got = a; },
    );

    t.press('enter');
    await t.settle();
    t.type('Buy milk');
    t.press('enter');
    await t.settle();

    // Still asking, now with a list.
    expect(got).toBeNull();
    expect(t.hasText('high')).toBe(true);

    t.press('enter');
    await t.settle();
    expect(got).toEqual({ title: 'Buy milk', priority: 'high' });
    await t.unmount();
  });
});

describe('scoped commands', () => {
  it('a component-scoped registration wins while it is focused', async () => {
    const results: string[] = [];

    const Panel = defineComponent<{ name: string }>('ScopedPanel', ({ name }) => {
      const [_, setTick] = useState(0);
      return h('box', {
        id: `panel-${name}`,
        focusable: true,
        onKey: (event: { name: string }) => {
          if (event.name === 's') {
            results.push(name);
            setTick((n) => n + 1);
            return true;
          }
          return false;
        },
      }, h('text', { content: name }));
    });

    const t = await render(
      h('box', { direction: 'column' }, h(Panel, { name: 'left' }), h(Panel, { name: 'right' })),
      { width: 30, height: 6 },
    );

    t.tab();
    t.press('s');
    t.tab();
    t.press('s');
    expect(results).toEqual(['left', 'right']);
    await t.unmount();
  });
});
