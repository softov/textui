import { describe, expect, it, vi } from 'vitest';
import { renderApp, render } from '../src/index.js';
import { h, defineComponent, useState } from '@textui/core';
import { filterCommands } from '@textui/widgets';

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

  /**
   * The category names the group, above it, once.
   *
   * It used to sit in every row's right-hand column, so a list of four
   * screens said "Screens" four times - in the column the rows needed for
   * saying what they do, and still without marking where the group began.
   */
  const grouped = async (extra: Record<string, unknown> = {}) => renderApp({
    width: 60,
    height: 20,
    onBoot: (app) => {
      app.commands.register({ id: 'go.back', title: 'Back', category: 'Navigation', description: 'Return to the previous screen', slots: ['palette'], run: () => {} });
      app.commands.register({ id: 'go.sessions', title: 'Sessions', category: 'Screens', description: 'List all sessions', slots: ['palette'], run: () => {} });
      app.commands.register({ id: 'go.hosts', title: 'Hosts', category: 'Screens', description: 'Manage all hosts', slots: ['palette'], run: () => {} });
      app.open({ surface: 'main', key: 'p', target: { component: 'CommandPalette', ...extra } });
    },
  });

  it('names each category once, above its group', async () => {
    const t = await grouped();
    await t.settle();

    const category = (name: string): number =>
      t.lines().filter((line) => line.includes(name)).length;

    expect(category('Navigation')).toBe(1);
    expect(category('Screens')).toBe(1);

    // On a line of its own, above the first row of the group - not in a row.
    const heading = t.lines().findIndex((line) => line.includes('Screens'));
    expect(t.lines()[heading]).not.toContain('Sessions');
    expect(t.lines()[heading]).not.toContain('Hosts');
    expect(t.lines()[heading + 1]).toContain('Sessions');

    // And the column the category used to occupy says what the row does.
    expect(t.hasText('List all sessions')).toBe(true);
    await t.unmount();
  });

  it('drops the headings once a query sorts the rows', async () => {
    const t = await grouped();
    t.type('s');
    await t.settle();

    // Relevance order interleaves the categories, so a heading would sit over
    // one row and claim to start a group.
    expect(t.hasText('Screens')).toBe(false);
    expect(t.hasText('Navigation')).toBe(false);
    await t.unmount();
  });

  it('leaves the headings out when grouping is off', async () => {
    const t = await grouped({ grouped: false });
    await t.settle();

    expect(t.hasText('Screens')).toBe(false);
    expect(t.hasText('Sessions')).toBe(true);
    await t.unmount();
  });

  /**
   * A sentence needs a line, not a column.
   *
   * Four approval modes named in two words each are told apart entirely by
   * what is written under them. Beside the label that sentence shares the
   * width with it, so every row shows the same truncated half and the reader
   * is choosing on the part that was cut.
   */
  it('puts each description on its own line when the argument asks', async () => {
    const t = await renderApp({
      width: 50,
      height: 16,
      onBoot: (app) => {
        app.commands.register({
          id: 'set.mode',
          title: 'Permissions',
          slots: ['palette'],
          args: [{
            name: 'value',
            type: 'string',
            required: true,
            descriptions: 'below',
            choices: [
              { value: 'ask', label: 'Ask each time', description: 'Every tool call is confirmed' },
              { value: 'edits', label: 'Accept edits', description: 'File edits run; commands still ask' },
            ],
          }],
          run: () => {},
        });
        app.open({ surface: 'main', key: 'p', target: { component: 'CommandPalette', openAt: 'set.mode', width: 50 } });
      },
    });
    await t.settle();

    const label = t.lines().findIndex((line) => line.includes('Ask each time'));
    expect(label).toBeGreaterThan(-1);
    // The sentence is not on the label's line - it is on the next one, and
    // whole rather than cut to whatever the label left over.
    expect(t.lines()[label]).not.toContain('Every tool call');
    expect(t.lines()[label + 1]).toContain('Every tool call is confirmed');
    // Indented to the label, not to the cursor's gutter.
    expect(t.lines()[label + 1]?.indexOf('Every')).toBe(t.lines()[label]?.indexOf('Ask each'));
    await t.unmount();
  });

  /**
   * The picker opens on the answer already in force.
   *
   * A question about a setting is asked in order to change it *from*
   * something, and that something is where the reader is looking. Opening at
   * the top says the first option is the current one, which is wrong on every
   * list where it is not - and costs a press to get back to where you began.
   */
  const choosing = async (extra: Record<string, unknown> = {}, width?: number) => {
    const t = await renderApp({
      width: width ?? 60,
      height: 18,
      onBoot: (app) => {
        app.commands.register({
          id: 'set.mode',
          title: 'Permissions',
          slots: ['palette'],
          args: [{
            name: 'value',
            type: 'string',
            required: true,
            choices: [
              { value: 'ask', label: 'Ask each time' },
              { value: 'edits', label: 'Accept edits' },
              { value: 'plan', label: 'Plan only' },
            ],
            ...extra,
          }],
          run: () => {},
        });
        app.open({ surface: 'main', key: 'p', target: { component: 'CommandPalette', openAt: 'set.mode' } });
      },
    });
    for (let i = 0; i < 4; i++) await t.settle();
    return t;
  };

  /** The row the cursor is on, which is the one carrying the marker. */
  const marked = (t: Awaited<ReturnType<typeof choosing>>): string =>
    t.lines().find((line) => line.includes('\u25b8')) ?? '';

  it('starts on the value the argument calls its default', async () => {
    const t = await choosing({ default: 'plan' });
    expect(marked(t)).toContain('Plan only');
    await t.unmount();
  });

  it('starts at the top when the argument names no default', async () => {
    const t = await choosing();
    expect(marked(t)).toContain('Ask each time');
    await t.unmount();
  });

  /**
   * How wide the panel is.
   *
   * A constant is too wide for a list of one-word answers and too narrow for a
   * list of sentences, and it is the same constant either way.
   */
  const panel = (t: Awaited<ReturnType<typeof choosing>>): number => {
    const line = t.lines().find((row) => row.includes('Plan only')) ?? '';
    return line.trimEnd().length;
  };

  it('fits the panel to its widest row', async () => {
    const narrow = await choosing({}, 100);
    const wide = await choosing({
      choices: [
        { value: 'ask', label: 'Ask each time' },
        { value: 'edits', label: 'Accept edits' },
        { value: 'plan', label: 'Plan only, and do not touch a single file until it is agreed' },
      ],
    }, 100);

    expect(panel(wide)).toBeGreaterThan(panel(narrow));
    await narrow.unmount();
    await wide.unmount();
  });

  it('stops at maxWidth, however long the rows are', async () => {
    const t = await renderApp({
      width: 100,
      height: 18,
      onBoot: (app) => {
        app.commands.register({
          id: 'set.mode', title: 'Permissions', slots: ['palette'],
          args: [{
            name: 'value', type: 'string', required: true,
            choices: [{ value: 'a', label: 'A'.repeat(200) }],
          }],
          run: () => {},
        });
        app.open({ surface: 'main', key: 'p', target: { component: 'CommandPalette', openAt: 'set.mode', maxWidth: 40 } });
      },
    });
    for (let i = 0; i < 4; i++) await t.settle();

    expect(t.lines().every((line) => line.trimEnd().length <= 40)).toBe(true);
    await t.unmount();
  });

  it('takes a stated width as stated', async () => {
    const t = await renderApp({
      width: 100,
      height: 18,
      onBoot: (app) => {
        app.commands.register({
          id: 'set.mode', title: 'Permissions', slots: ['palette'],
          args: [{ name: 'value', type: 'string', required: true, choices: [{ value: 'a', label: 'A' }] }],
          run: () => {},
        });
        app.open({ surface: 'main', key: 'p', target: { component: 'CommandPalette', openAt: 'set.mode', width: 70 } });
      },
    });
    for (let i = 0; i < 4; i++) await t.settle();

    // One row of one letter, and the panel is still 70 wide because it was
    // told to be.
    const widest = Math.max(...t.lines().map((line) => line.trimEnd().length));
    expect(widest).toBe(70);
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

/**
 * Registered but gated is not the same as absent.
 *
 * `alt+left` with no file open used to report "no command registered as
 * go.previousTab" about a command registered forty lines away, whose `when`
 * simply did not pass. A `when` that does not pass is the command saying "not
 * now", which is what it is for.
 */
describe('a command whose when does not pass', () => {
  it('does nothing, rather than claiming it does not exist', async () => {
    let ran = 0;
    const t = await renderApp({
      width: 40, height: 6,
      root: { component: 'text', content: 'hi' },
      onBoot: (app) => app.commands.register({
        id: 'test.gated',
        title: 'Gated',
        when: '$/test/open',
        run: () => { ran++; },
      }),
    });

    await expect(t.app.execute('test.gated')).resolves.toBeUndefined();
    expect(ran, 'and it did not run').toBe(0);

    t.app.store.set('$/test/open' as never, true);
    await t.app.execute('test.gated');
    expect(ran, 'and it runs once the clause passes').toBe(1);
    await t.unmount();
  });

  it('still throws for a name nothing was ever registered under', async () => {
    const t = await renderApp({
      width: 40, height: 6,
      root: { component: 'text', content: 'hi' },
    });
    // A keybinding pointing at a typo has to be findable.
    await expect(t.app.execute('test.nosuch')).rejects.toThrow(/no command registered/);
    await t.unmount();
  });
});
