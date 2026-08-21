import { describe, expect, it } from 'vitest';
import { renderApp } from '@textui/testing';
import type { Harness } from '@textui/testing';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { registerTodo } from '../src/app.js';
import { fileStore } from '../src/storage.js';
import { getTask, tasksIn } from '../src/data.js';

/**
 * The example, mounted.
 *
 * An example nothing checks is an example that is already broken, and the
 * things worth checking here are the three that a screenshot cannot tell you
 * apart: that the sidebar survives navigating, that a screen's scope dies with
 * it, and that the same task is one task however many places show it.
 */

const SIZES = [
  { width: 100, height: 26 },
  { width: 82, height: 20 },
];

async function open(size = SIZES[0] as { width: number; height: number }): Promise<Harness> {
  const t = await renderApp({
    ...size,
    shell: 'workbench',
    theme: 'workbench',
    onBoot: (app) => { registerTodo(app); },
  });
  for (let i = 0; i < 8; i++) await t.settle();
  return t;
}

describe.each(SIZES.map((s) => [`${s.width}x${s.height}`, s] as const))('todo at %s', (_name, size) => {
  it('opens on the inbox, with the navigation beside it', async () => {
    const t = await open(size);

    expect(t.app.screens.current()?.id).toBe('tasks');
    expect(t.hasText('Inbox')).toBe(true);
    // A short title, because a narrow pane truncates a long one - which is
    // the list doing its job, not the test finding a bug.
    expect(t.hasText('Release package')).toBe(true);
    await t.unmount();
  });

  it('draws every row inside the frame it was given', async () => {
    const t = await open(size);
    expect(t.lines().every((line) => line.length <= size.width)).toBe(true);
    await t.unmount();
  });
});

describe('pages', () => {
  it('opens a task as a page and comes back', async () => {
    const t = await open();
    t.app.store.set('$/todo/ui/selected', 't1');
    await t.settle();

    await t.app.execute('task.open');
    for (let i = 0; i < 4; i++) await t.settle();
    expect(t.app.screens.current()?.id).toBe('task');
    // The page shows what the side panel had no room for.
    expect(t.hasText('Reproduce')).toBe(true);

    await t.app.execute('go.back');
    for (let i = 0; i < 4; i++) await t.settle();
    expect(t.app.screens.current()?.id).toBe('tasks');
    await t.unmount();
  });

  it('keeps the navigation mounted while the page changes', async () => {
    const t = await open();
    const nav = () => t.app.surfaces.mounts('sidebar').map((m) => m.key);
    expect(nav()).toEqual(['nav']);

    await t.app.execute('go.projects');
    for (let i = 0; i < 4; i++) await t.settle();
    expect(t.app.screens.current()?.id).toBe('projects');

    // A surface is not a screen. The thing you navigate with survives
    // navigating, which is the entire reason the two are different.
    expect(nav()).toEqual(['nav']);
    expect(t.hasText('Advisor')).toBe(true);
    await t.unmount();
  });

  it('forgets a screen scope when the screen is popped', async () => {
    const t = await open();
    t.app.screens.push('project', { projectId: 'advisor' });
    for (let i = 0; i < 4; i++) await t.settle();

    t.app.store.set('$/screen.project/tab', 'notes');
    await t.settle();
    expect(t.hasText('Support tooling')).toBe(true);

    t.app.screens.pop();
    for (let i = 0; i < 4; i++) await t.settle();
    // Which tab you were on was about that visit, not about the project.
    expect(t.store.get('$/screen.project/tab')).toBeUndefined();
    await t.unmount();
  });

  it('keeps the search screen alive, because a query is worth keeping', async () => {
    const t = await open();
    await t.app.execute('go.search');
    for (let i = 0; i < 4; i++) await t.settle();

    t.app.store.set('$/todo/search/query', 'auth');
    for (let i = 0; i < 4; i++) await t.settle();
    expect(t.hasText('Fix authentication bug')).toBe(true);

    await t.app.execute('go.tasks');
    await t.app.execute('go.search');
    for (let i = 0; i < 4; i++) await t.settle();
    expect(t.store.get('$/todo/search/query')).toBe('auth');
    await t.unmount();
  });
});

describe('one task, however many places show it', () => {
  it('completes from a command and redraws everywhere', async () => {
    const t = await open();
    t.app.store.set('$/todo/ui/selected', 't4');
    await t.settle();
    expect(getTask(t.app.store, 't4')?.state).toBe('active');
    expect(t.hasText('[ ] Release package')).toBe(true);

    await t.app.execute('task.toggle');
    for (let i = 0; i < 4; i++) await t.settle();

    expect(getTask(t.app.store, 't4')?.state).toBe('completed');
    // Nothing was passed between the list and the panel: both read the store
    // and both subscribed to the subtree the write landed in.
    expect(t.hasText('[x] Release package')).toBe(true);
    await t.unmount();
  });

  it('adds a task through the command that asks for its title', async () => {
    const t = await open();
    const before = tasksIn(t.app.store, { kind: 'all' }).length;

    await t.app.execute('task.new', { title: 'Something new' });
    for (let i = 0; i < 4; i++) await t.settle();

    expect(tasksIn(t.app.store, { kind: 'all' })).toHaveLength(before + 1);
    expect(t.hasText('Something new')).toBe(true);
    await t.unmount();
  });

  it('archives out of every live view at once', async () => {
    const t = await open();
    t.app.store.set('$/todo/ui/selected', 't1');
    await t.settle();

    await t.app.execute('task.archive');
    for (let i = 0; i < 4; i++) await t.settle();

    expect(t.hasText('Fix authenticati')).toBe(false);
    expect(tasksIn(t.app.store, { kind: 'state', state: 'archived' })).toHaveLength(2);
    await t.unmount();
  });
});

describe('on a terminal that can only do ASCII', () => {
  it('draws nothing that terminal cannot draw', async () => {
    const t = await renderApp({
      width: 100,
      height: 26,
      shell: 'workbench',
      theme: 'workbench',
      capabilities: { unicode: 'ascii', wideChars: false },
      onBoot: (app) => { registerTodo(app); },
    });
    for (let i = 0; i < 8; i++) await t.settle();

    const offending = [...new Set([...t.text()].filter((c) => (c.codePointAt(0) as number) > 0x7f))];
    expect(offending).toEqual([]);
    await t.unmount();
  });
});

/**
 * The keyboard, driven as bytes.
 *
 * `press` synthesises an event and a terminal sends bytes; where those two
 * disagree a key works in a test and never in the product. Everything a person
 * would actually press goes in as bytes.
 */
describe('driving it', () => {
  it('opens with focus in the screen, not nowhere', async () => {
    const t = await open();
    // A screen takes focus when it arrives, so the first arrow press moves
    // something instead of being swallowed.
    const focused = t.app.focus.focused();
    expect(focused).not.toBeNull();
    expect(t.app.focus.scopeOf(focused as string)).toBe('screen:tasks');
    await t.unmount();
  });

  it('filters the list as the sidebar selection moves', async () => {
    const t = await open();
    // The navigation is not in a screen - it is mounted on the sidebar - so
    // it is the global scope's focusable, and this says which one it is
    // rather than counting tabs to it.
    t.focus(t.app.focus.order('__global__')[0] as string);
    await t.settle();

    t.press('down');
    for (let i = 0; i < 4; i++) await t.settle();
    expect(t.app.screens.current()?.params?.view).toBe('today');

    // Four more rows, over a heading. A sidebar that stopped at "PROJECTS"
    // would be a sidebar whose bottom half no keyboard can reach.
    t.press('down');
    t.press('down');
    t.press('down');
    t.press('down');
    for (let i = 0; i < 4; i++) await t.settle();

    // Still the list, filtered - not a different page. A project is a view of
    // the tasks, the way `Today` is.
    expect(t.app.screens.current()?.id).toBe('tasks');
    expect(t.app.screens.current()?.params?.view).toBe('project:advisor');
    expect(t.hasText('Advisor')).toBe(true);
    await t.unmount();
  });

  it('opens the project page on enter, where there is more than a filter', async () => {
    const t = await open();
    t.focus(t.app.focus.order('__global__')[0] as string);
    await t.settle();
    for (let i = 0; i < 5; i++) { t.press('down'); await t.settle(); }
    expect(t.app.screens.current()?.params?.view).toBe('project:advisor');

    t.press('enter');
    for (let i = 0; i < 4; i++) await t.settle();

    // Notes and activity are things a filter cannot show, which is the whole
    // reason enter goes somewhere at all.
    expect(t.app.screens.current()?.id).toBe('project');
    expect(t.hasText('Notes')).toBe(true);
    await t.unmount();
  });

  it('completes with the space bar', async () => {
    const t = await open();
    for (let i = 0; i < 4; i++) await t.settle();

    const first = t.app.store.get<string>('$/todo/ui/selected') as string;
    expect(getTask(t.app.store, first)?.state).toBe('active');

    // 0x20, not a synthesised `{ name: 'space' }`.
    t.feed(' ');
    for (let i = 0; i < 4; i++) await t.settle();
    expect(getTask(t.app.store, first)?.state).toBe('completed');
    await t.unmount();
  });

  it('has three panes, and reaches all of them', async () => {
    const t = await open();
    for (let i = 0; i < 6; i++) await t.settle();

    // Navigation, list, detail. The detail is a stop because it scrolls, and
    // something that scrolls and cannot be focused only scrolls with a mouse.
    expect(t.app.focus.order()).toHaveLength(3);
    await t.unmount();
  });

  it('asks for a title rather than making an untitled task', async () => {
    const t = await open();
    for (let i = 0; i < 4; i++) await t.settle();

    t.feed('n');
    for (let i = 0; i < 6; i++) await t.settle();
    // The command declares "I need a title" and the palette collects it. No
    // dialog is written anywhere in this example.
    expect(t.hasText('What needs doing')).toBe(true);

    t.type('Buy milk');
    t.press('enter');
    for (let i = 0; i < 6; i++) await t.settle();

    expect(t.app.layers.entries()).toHaveLength(0);
    expect(t.hasText('Buy milk')).toBe(true);
    await t.unmount();
  });

  it('asks before deleting, and does nothing when the answer is no', async () => {
    const t = await open();
    t.app.store.set('$/todo/ui/selected', 't1');
    await t.settle();

    void t.app.execute('task.delete');
    for (let i = 0; i < 6; i++) await t.settle();
    // The title, not the message: a long task name wraps the message and the
    // test would be asserting on where the line broke.
    expect(t.hasText('Delete task')).toBe(true);

    t.press('escape');
    for (let i = 0; i < 6; i++) await t.settle();
    expect(getTask(t.app.store, 't1')).toBeDefined();

    void t.app.execute('task.delete');
    for (let i = 0; i < 6; i++) await t.settle();
    t.press('enter');
    for (let i = 0; i < 6; i++) await t.settle();
    expect(getTask(t.app.store, 't1')).toBeUndefined();
    await t.unmount();
  });

  it('scrolls the detail panel', async () => {
    const t = await open();
    t.app.store.set('$/todo/ui/selected', 't1');
    for (let i = 0; i < 4; i++) await t.settle();

    t.tab();
    for (let i = 0; i < 4; i++) await t.settle();
    // The right-hand column only, so this cannot pass because a highlight
    // moved somewhere else on the screen.
    const panel = (): string[] => t.lines().map((line) => line.slice(70)).filter((l) => l.trim() !== '');
    const before = panel();
    expect(before.some((l) => l.includes('Project'))).toBe(true);

    t.press('down');
    t.press('down');
    t.press('down');
    for (let i = 0; i < 4; i++) await t.settle();

    // A panel with more in it than fits and no way to scroll is a panel with a
    // hidden bottom half: the top has to actually leave.
    expect(panel().some((l) => l.includes('Project  Advisor'))).toBe(false);
    await t.unmount();
  });

  it('gives a pushed page the keyboard', async () => {
    const t = await open();
    t.app.screens.push('task', { taskId: 't1' });
    for (let i = 0; i < 6; i++) await t.settle();

    // The push unmounted whatever had focus. A page nothing focuses is a page
    // whose text cannot even be scrolled - which is how this was found.
    const focused = t.app.focus.focused();
    expect(focused).not.toBeNull();
    expect(t.app.focus.scopeOf(focused as string)).toBe('screen:task');
    await t.unmount();
  });
});

/**
 * The database is a JSON file.
 *
 * Not "saving": a persistence adapter, so nothing in the application calls
 * save and every command writes to the store the same way. What is checked
 * here is the round trip and the two things around it - that what is on disk
 * beats the seed, and that what is only about this run is not written.
 */
describe('the file it keeps', () => {
  const withFile = async (path: string) => {
    const t = await renderApp({
      width: 100,
      height: 26,
      shell: 'workbench',
      theme: 'workbench',
      onBoot: (app) => {
        registerTodo(app);
        app.store.registerPersistence(fileStore({ path, debounceMs: 1 }));
      },
    });
    for (let i = 0; i < 8; i++) await t.settle();
    return t;
  };

  const settleWrite = async (t: { settle(): Promise<void> }) => {
    // The adapter coalesces; give the timer a turn.
    for (let i = 0; i < 6; i++) {
      await new Promise((r) => setTimeout(r, 5));
      await t.settle();
    }
  };

  it('writes what changed, and reads it back into a new run', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'todo-'));
    const path = join(dir, 'todo.json');

    const first = await withFile(path);
    await first.app.execute('task.new', { title: 'From the file' });
    await settleWrite(first);
    await first.unmount();

    const saved = JSON.parse(await readFile(path, 'utf8')) as {
      version: number;
      tasks: Record<string, { title: string }>;
      settings: unknown;
    };
    expect(saved.version).toBe(1);
    expect(Object.values(saved.tasks).some((t) => t.title === 'From the file')).toBe(true);
    // What is about this run, not about the data: a restored selection would
    // point at whatever happened to be highlighted last time.
    expect(saved).not.toHaveProperty('ui');

    const second = await withFile(path);
    expect(second.hasText('From the file')).toBe(true);
    await second.unmount();
    await rm(dir, { recursive: true, force: true });
  });

  it('lets the file win over the seed', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'todo-'));
    const path = join(dir, 'todo.json');
    await writeFile(path, JSON.stringify({
      version: 1,
      tasks: { z1: { id: 'z1', title: 'Only this', state: 'active', projectId: null, tags: [], due: 'none', priority: 'normal', description: '', subtasks: [], activity: [] } },
      projects: {},
    }), 'utf8');

    const t = await withFile(path);
    // Hydration runs after `onBoot`, so the seed is a default and the file is
    // the answer.
    expect(t.hasText('Only this')).toBe(true);
    expect(t.hasText('Fix authenticati')).toBe(false);
    await t.unmount();
    await rm(dir, { recursive: true, force: true });
  });

  it('starts from the seed when there is no file', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'todo-'));
    const t = await withFile(join(dir, 'nothing-here.json'));

    // A missing file is a first run, not an error.
    expect(t.hasText('Release package')).toBe(true);
    await t.unmount();
    await rm(dir, { recursive: true, force: true });
  });
});
