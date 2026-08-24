import type { BoxProps, CommandDefinition, Disposable, TextUIApp } from '@textui/core';
import { createBag, defineComponent, useApp, useStoreSubtree, useTheme } from '@textui/core';
import { KeyHints, Row, confirm, registerBuiltins } from '@textui/widgets';
import { Nav, TaskDetail, TaskList } from './components.js';
import {
  EditTaskPage, ProjectListPage, ProjectPage, SearchPage, SettingsPage,
  TagListPage, TaskListPage, TaskPage,
} from './screens.js';
import {
  DEFAULT_VIEW, QUERY, TASKS, addTask, archiveTask, deleteTask, getTask, seed,
  setView, settings, tasksIn, toggleTask,
} from './data.js';

/**
 * A todo application, as an application.
 *
 * What it is here to show is the difference between the three ways a thing can
 * be on screen, because they are easy to conflate and expensive to get wrong:
 *
 *   a **surface** is a region of the frame - the nav is mounted on `sidebar`
 *   and does not remount when the page changes, which is why navigating with
 *   it does not destroy it;
 *
 *   a **screen** is what is in `main`, one at a time, with a stack behind it,
 *   its own focus scope and its own store scope;
 *
 *   a **layer** is over the top of both - the palette, a confirm - and belongs
 *   to neither.
 *
 * Everything a menu or a key can do is a command, so the palette gets it for
 * free and nothing is reachable one way only.
 */

const Hints = defineComponent<BoxProps>('TodoHints', (props) => {
  const theme = useTheme();
  return (
    <KeyHints
      {...props}
      hints={[
        { keys: 'tab', label: 'pane' },
        // Asked for, not written here. An arrow typed into a string is a `?`
        // on a console that has no arrows, and the row it ruins is the one
        // telling you how to move.
        { keys: `${theme.glyphs.arrowUp}${theme.glyphs.arrowDown}`, label: 'move' },
        { keys: 'enter', label: 'open' },
        { keys: 'space', label: 'done' },
        { keys: 'n', label: 'new' },
        { keys: 'e', label: 'edit' },
        { keys: 'del', label: 'delete' },
        { keys: '/', label: 'search' },
        { keys: 'ctrl+p', label: 'commands' },
        { keys: 'q', label: 'quit' },
      ]}
    />
  );
});

const Header = defineComponent<Record<string, never>>('TodoHeader', () => {
  const app = useApp();
  const theme = useTheme();
  useStoreSubtree(TASKS);
  const open = tasksIn(app.store, { status: 'all', project: null, tag: null })
    .filter((task) => task.state === 'active').length;

  return (
    <Row gap={1} padding={[0, 1]}>
      <text content="Todo" bold fg="accent" />
      <text content={theme.glyphs.separator} fg="subtle" />
      <text content={`${open} open`} fg="muted" flex={1} />
      <text content="? help   ctrl+p commands" fg="subtle" />
    </Row>
  );
});

const Status = defineComponent<Record<string, never>>('TodoStatus', () => {
  const app = useApp();
  const theme = useTheme();
  useStoreSubtree(TASKS);
  const screen = app.screens.current();

  return (
    // One row, because the status surface is one row. The keys go on the left
    // where there is room for them and where they are read; where you are goes
    // on the right, which is where you look when you are lost.
    <Row gap={2}>
      <Hints flex={1} />
      <text
        content={[screen?.id ?? '—', app.screens.canGoBack() ? 'esc back' : '']
          .filter(Boolean)
          .join(`  ${theme.glyphs.separator}  `)}
        fg="muted"
      />
    </Row>
  );
});

export interface TodoOptions {
  /** Also register the shipped catalog. Off when the host already did it. */
  builtins?: boolean;
}

/**
 * Everything this example puts into an application, in one call.
 *
 * It takes an app rather than making one, so the whole thing can be mounted by
 * a test - which is the only reason its smoke test can exist.
 */
export function registerTodo(app: TextUIApp, options: TodoOptions = {}): Disposable {
  const bag = createBag();
  if (options.builtins !== false) bag.add(registerBuiltins(app));

  for (const definition of [
    { component: 'Nav', render: Nav },
    { component: 'TaskList', render: TaskList },
    { component: 'TaskDetail', render: TaskDetail },
    { component: 'TaskListPage', render: TaskListPage },
    { component: 'TaskPage', render: TaskPage },
    { component: 'EditTaskPage', render: EditTaskPage },
    { component: 'ProjectListPage', render: ProjectListPage },
    { component: 'ProjectPage', render: ProjectPage },
    { component: 'TagListPage', render: TagListPage },
    { component: 'SearchPage', render: SearchPage },
    { component: 'SettingsPage', render: SettingsPage },
    { component: 'TodoHeader', render: Header },
    { component: 'TodoStatus', render: Status },
    { component: 'TodoHints', render: Hints },
  ]) {
    bag.add(app.components.register({
      component: definition.component,
      category: 'template',
      renderer: { kind: 'function', render: definition.render },
    }));
  }

  seed(app.store);

  // The frame. Only `main` changes as you navigate.
  // The name goes in the title bar. It was the sidebar's heading, which made
  // the sidebar look like one tree called "Todo" with everything under it -
  // and "Todo" is the application, not a place in it.
  bag.add(app.surfaces.open({ surface: 'header', key: 'title', target: { component: 'TodoHeader' } }));
  bag.add(app.surfaces.open({ surface: 'sidebar', key: 'nav', target: { component: 'Nav' } }));
  bag.add(app.surfaces.open({ surface: 'status', key: 'status', target: { component: 'TodoStatus' } }));

  for (const screen of [
    { id: 'tasks', component: 'TaskListPage' },
    { id: 'task', component: 'TaskPage' },
    { id: 'task.edit', component: 'EditTaskPage' },
    { id: 'projects', component: 'ProjectListPage' },
    // The project page keeps which tab you were on while it is open and
    // forgets it when it is popped, which is what a screen scope is for.
    { id: 'project', component: 'ProjectPage' },
    { id: 'tags', component: 'TagListPage' },
    { id: 'search', component: 'SearchPage', keepAlive: true },
    { id: 'settings', component: 'SettingsPage' },
  ]) {
    bag.add(app.screens.register(screen));
  }

  for (const command of commands(app)) bag.add(app.commands.register(command));

  // `n` asks for the title before it makes anything, and the asking is the
  // palette's job: the command declares an argument and the palette collects
  // it, so there is no "new task" dialog written anywhere.
  bag.add(app.keybindings.register({
    keys: 'n', commandId: 'app.palette', args: { at: 'task.new' },
  }));

  for (const [keys, commandId] of [
    ['ctrl+p', 'app.palette'],
    ['escape', 'go.back'],

    ['space', 'task.toggle'],
    // Not `enter`: the list opens what it activates, and a global enter would
    // fire wherever a control did not consume it - in a form, on a scrolling
    // panel - which is somewhere nobody pressed it.
    ['e', 'task.edit'],
    ['x', 'task.archive'],
    ['delete', 'task.delete'],
    ['/', 'go.search'],
    ['g', 'go.tasks'],
  ] as const) {
    bag.add(app.keybindings.register({ keys, commandId }));
  }

  app.screens.reset('tasks');
  return bag;
}

/** What the application can do. The palette is the list of these, not a menu. */
function commands(app: TextUIApp): CommandDefinition[] {
  const selected = (): string | null => app.store.get<string>('$/todo/ui/selected') ?? null;

  return [
    {
      id: 'app.palette',
      title: 'Command Palette',
      category: 'Go',
      // Not offered inside itself: an entry whose only effect is to redraw
      // what you are already looking at.
      slots: [],
      args: [{ name: 'at', type: 'string' as const }],
      run: (args: Record<string, unknown>) => {
        app.layers.open({
          id: 'palette',
          layer: 'modal',
          scrim: true,
          trapFocus: true,
          dismissOnEscape: true,
          node: {
            component: 'CommandPalette',
            width: 58,
            commands: app.commands.list({ slot: 'palette', enabledOnly: true }),
            // A caller that already knows which question to ask - `n`, for a
            // new task - opens the palette *at* that command rather than on
            // the whole list with a word typed into the search box.
            ...(typeof args.at === 'string' ? { openAt: args.at } : {}),
            onClose: { handler: () => app.layers.close('palette') },
          },
        });
      },
    },
    {
      id: 'go.back',
      title: 'Back',
      category: 'Go',
      slots: ['palette'],
      run: () => {
        // Escape closes what is on top of the screen before it leaves the
        // screen, and the layer manager has already had its turn by the time
        // a keybinding runs.
        app.screens.pop();
      },
    },
    {
      id: 'go.tasks',
      title: 'Go to Inbox',
      category: 'Go',
      slots: ['palette'],
      run: () => { setView(app.store, DEFAULT_VIEW); app.screens.replace('tasks'); },
    },
    {
      id: 'go.today',
      title: 'Go to Today',
      category: 'Go',
      slots: ['palette'],
      run: () => { setView(app.store, { status: 'today' }); app.screens.replace('tasks'); },
    },
    { id: 'go.projects', title: 'Go to Projects', category: 'Go', slots: ['palette'], run: () => app.screens.replace('projects') },
    { id: 'go.tags', title: 'Go to Tags', category: 'Go', slots: ['palette'], run: () => app.screens.replace('tags') },
    { id: 'go.search', title: 'Search', category: 'Go', slots: ['palette'], run: () => app.screens.replace('search') },
    { id: 'go.settings', title: 'Settings', category: 'Go', slots: ['palette'], run: () => app.screens.replace('settings') },
    {
      id: 'task.open',
      title: 'Open Task',
      category: 'Task',
      slots: ['palette'],
      run: () => {
        const id = selected();
        if (id) app.screens.push('task', { taskId: id });
      },
    },
    {
      id: 'task.toggle',
      title: 'Complete / Reopen',
      category: 'Task',
      slots: ['palette'],
      run: () => {
        const id = currentTask(app);
        if (id) toggleTask(app.store, id);
      },
    },
    {
      id: 'task.archive',
      title: 'Archive',
      category: 'Task',
      slots: ['palette'],
      run: () => {
        const id = currentTask(app);
        if (!id) return;
        archiveTask(app.store, id);
        // Archiving what is selected clears the selection: leaving it would
        // leave the detail panel describing something no view can reach.
        if (app.store.get<string>('$/todo/ui/selected') === id) {
          app.store.set('$/todo/ui/selected', null);
        }
      },
    },
    {
      id: 'task.edit',
      title: 'Edit',
      category: 'Task',
      slots: ['palette'],
      run: () => {
        const id = currentTask(app);
        if (id) app.screens.push('task.edit', { taskId: id });
      },
    },
    {
      id: 'task.delete',
      title: 'Delete',
      category: 'Task',
      slots: ['palette'],
      run: async () => {
        const id = currentTask(app);
        const task = id ? getTask(app.store, id) : undefined;
        if (!id || !task) return;

        // Ask, unless the settings say not to. The dialog is a layer, so it is
        // over the screen rather than in it, and `confirm` resolves false when
        // it is dismissed - there is no third answer to handle.
        if (settings(app.store).confirmDelete) {
          const yes = await confirm(app.layers, {
            title: 'Delete task',
            message: `Delete "${task.title}"? This cannot be undone.`,
            confirmLabel: 'Delete',
            cancelLabel: 'Keep',
            tone: 'danger',
          });
          if (!yes) return;
        }

        deleteTask(app.store, id);
        if (app.store.get<string>('$/todo/ui/selected') === id) {
          app.store.set('$/todo/ui/selected', null);
        }
        // Deleting what a page is showing leaves the page showing nothing.
        if (app.screens.current()?.id === 'task') app.screens.pop();
      },
    },
    {
      id: 'task.new',
      title: 'New Task',
      category: 'Task',
      slots: ['palette'],
      // The command says what it needs and the palette asks for it. That is
      // where the "new task" form comes from - no dialog is written here.
      args: [{ name: 'title', type: 'string' as const, required: true, description: 'What needs doing' }],
      run: (args: Record<string, unknown>) => {
        const title = String(args.title ?? '').trim();
        if (title === '') return;
        const task = addTask(app.store, { title });
        app.store.set('$/todo/ui/selected', task.id);
      },
    },
  ];
}

/**
 * Which task a command acts on.
 *
 * The one the task page is showing, if one is open; otherwise the one selected
 * in the list. A command that only ever read the list selection would do
 * nothing on the page you opened from it.
 */
function currentTask(app: TextUIApp): string | null {
  const screen = app.screens.current();
  if (screen?.id === 'task') {
    const id = screen.params?.taskId;
    if (typeof id === 'string' && getTask(app.store, id)) return id;
  }
  return app.store.get<string>('$/todo/ui/selected') ?? null;
}

export { QUERY };
