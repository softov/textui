import type { BindingPath, ReactiveStore } from '@textui/core';

/**
 * The model, and where it lives.
 *
 * Everything is in the store, keyed by id, and every screen reads it through
 * the selectors below rather than holding its own copy. That is what makes a
 * task edited on the task page redraw in the list behind it without either
 * one knowing the other exists.
 */

export type TaskState = 'active' | 'completed' | 'archived';
export type Due = 'today' | 'upcoming' | 'none';
export type Priority = 'high' | 'normal' | 'low';

export interface Subtask {
  title: string;
  done: boolean;
}

export interface Task {
  id: string;
  title: string;
  state: TaskState;
  projectId: string | null;
  tags: string[];
  due: Due;
  priority: Priority;
  description: string;
  subtasks: Subtask[];
  activity: { at: string; what: string }[];
}

export interface Project {
  id: string;
  name: string;
  notes: string;
}

export const TASKS = '$/todo/tasks' as BindingPath;
export const PROJECTS = '$/todo/projects' as BindingPath;
export const QUERY = '$/todo/search/query' as BindingPath;
export const SETTINGS = '$/todo/settings' as BindingPath;

export interface Settings {
  showCompleted: boolean;
  confirmDelete: boolean;
}

/**
 * A view of the list: which tasks, in what order.
 *
 * A named filter rather than a predicate passed around, because the name is
 * what a screen takes as a parameter, what the sidebar highlights, and what
 * ends up in the palette. A function could not be any of those.
 */

/**
 * The view: three questions, asked at the same time.
 *
 * Status, project and tag are separate axes and they *combine* - "Today, in
 * Advisor, tagged bug" is one view, not three you have to choose between.
 * Making them one exclusive choice is what turns a filter into a menu: picking
 * a project throws away the status, and nothing on screen says it did.
 *
 * `null` on an axis means "any", which is what the "All" row in each block
 * sets. Every axis is independent, so there is nothing to reset.
 */
export type Status = 'all' | 'today' | 'upcoming' | 'completed' | 'archived';

export interface View {
  status: Status;
  project: string | null;
  tag: string | null;
}

export const VIEW = '$/todo/ui/view' as BindingPath;
export const DEFAULT_VIEW: View = { status: 'all', project: null, tag: null };

export function currentView(store: ReactiveStore): View {
  return store.get<View>(VIEW) ?? DEFAULT_VIEW;
}

export function setView(store: ReactiveStore, patch: Partial<View>): void {
  store.set(VIEW, { ...currentView(store), ...patch });
}

/** Does this task pass one axis? */
function matchesStatus(task: Task, status: Status): boolean {
  switch (status) {
    // "All" means what is live. Archived is somewhere you go on purpose.
    case 'all': return task.state !== 'archived';
    case 'today': return task.state !== 'archived' && task.due === 'today';
    case 'upcoming': return task.state !== 'archived' && task.due === 'upcoming';
    case 'completed': return task.state === 'completed';
    case 'archived': return task.state === 'archived';
    default: return true;
  }
}

export function allTasks(store: ReactiveStore): Task[] {
  return Object.values(store.get<Record<string, Task>>(TASKS) ?? {});
}

/**
 * The tasks a view shows.
 *
 * Takes a partial view so a count can ask "how many with *this* project,
 * everything else as it is" - which is what makes the number beside a sidebar
 * row mean something rather than being the project's total.
 */
export function tasksIn(store: ReactiveStore, view: Partial<View> = {}): Task[] {
  const full: View = { ...currentView(store), ...view };
  return allTasks(store).filter((task) =>
    matchesStatus(task, full.status) &&
    (full.project === null || task.projectId === full.project) &&
    (full.tag === null || task.tags.includes(full.tag)));
}

/** Search is its own screen, and its own question. */
export function searchTasks(store: ReactiveStore, query: string): Task[] {
  const needle = query.trim().toLowerCase();
  if (needle === '') return [];
  return allTasks(store).filter((task) =>
    task.title.toLowerCase().includes(needle) ||
    task.description.toLowerCase().includes(needle) ||
    task.tags.some((tag) => tag.toLowerCase().includes(needle)));
}

/** What the list is showing, in words. */
export function viewTitle(store: ReactiveStore, view: View): string {
  const status: Record<Status, string> = {
    all: 'Inbox', today: 'Today', upcoming: 'Upcoming',
    completed: 'Completed', archived: 'Archived',
  };
  const parts = [status[view.status]];
  if (view.project) parts.push(getProject(store, view.project)?.name ?? view.project);
  if (view.tag) parts.push(`#${view.tag}`);
  return parts.join(' · ');
}

export function taskPath(id: string): BindingPath {
  return `${TASKS}/${id}` as BindingPath;
}

export function getTask(store: ReactiveStore, id: string): Task | undefined {
  return store.get<Task>(taskPath(id));
}

export function projects(store: ReactiveStore): Project[] {
  return Object.values(store.get<Record<string, Project>>(PROJECTS) ?? {});
}

export function getProject(store: ReactiveStore, id: string): Project | undefined {
  return store.get<Project>(`${PROJECTS}/${id}` as BindingPath);
}

/** Every tag any task carries, in order. */
export function tags(store: ReactiveStore): string[] {
  const seen = new Set<string>();
  for (const task of allTasks(store)) {
    for (const tag of task.tags) seen.add(tag);
  }
  return [...seen].sort((a, b) => a.localeCompare(b));
}

export function settings(store: ReactiveStore): Settings {
  return store.get<Settings>(SETTINGS) ?? { showCompleted: true, confirmDelete: true };
}

/** Mutations. Every one of them a whole-task write, so a subscriber sees it. */
export function writeTask(store: ReactiveStore, task: Task): void {
  store.set(taskPath(task.id), task);
}

export function toggleTask(store: ReactiveStore, id: string): void {
  const task = getTask(store, id);
  if (!task) return;
  const state: TaskState = task.state === 'completed' ? 'active' : 'completed';
  writeTask(store, {
    ...task,
    state,
    activity: [...task.activity, { at: now(store), what: state === 'completed' ? 'Completed' : 'Reopened' }],
  });
}

export function archiveTask(store: ReactiveStore, id: string): void {
  const task = getTask(store, id);
  if (!task) return;
  writeTask(store, {
    ...task,
    state: 'archived',
    activity: [...task.activity, { at: now(store), what: 'Archived' }],
  });
}

export function deleteTask(store: ReactiveStore, id: string): void {
  store.delete(taskPath(id));
}

export function addTask(store: ReactiveStore, partial: Partial<Task> & { title: string }): Task {
  const id = `t${nextId(store)}`;
  const task: Task = {
    id,
    state: 'active',
    projectId: null,
    tags: [],
    due: 'none',
    priority: 'normal',
    description: '',
    subtasks: [],
    activity: [{ at: now(store), what: 'Created' }],
    ...partial,
  };
  writeTask(store, task);
  return task;
}

/**
 * The next free id.
 *
 * Counting is not enough once anything has been deleted: delete `t3` of three
 * and the next task is `t3` again, which is a different task wearing a name
 * the file already used.
 */
function nextId(store: ReactiveStore): number {
  const all = Object.keys(store.get<Record<string, Task>>(TASKS) ?? {});
  const highest = all.reduce((top, id) => {
    const n = Number(id.replace(/^t/, ''));
    return Number.isFinite(n) && n > top ? n : top;
  }, 0);
  return highest + 1;
}

/**
 * A timestamp the example can be tested against.
 *
 * The clock is in the store, so a test can set it and a screenshot of this
 * application is the same screenshot tomorrow. An application with a real
 * clock reads one here instead.
 */
export function now(store: ReactiveStore): string {
  return store.get<string>('$/todo/now' as BindingPath) ?? '00:00';
}

export const SEED: { tasks: Task[]; projects: Project[] } = {
  projects: [
    { id: 'advisor', name: 'Advisor', notes: 'Support tooling. Desk is a provider, not a table.' },
    { id: 'scena', name: 'Scena', notes: 'Split progressively: sdk and core first.' },
    { id: 'keepr', name: 'Keepr', notes: '' },
  ],
  tasks: [
    {
      id: 't1',
      title: 'Fix authentication bug',
      state: 'active',
      projectId: 'advisor',
      tags: ['bug', 'backend'],
      due: 'today',
      priority: 'high',
      description: 'Authentication expires when the CLI refreshes its session, and the refresh path never re-reads the token it just wrote.',
      subtasks: [
        { title: 'Reproduce', done: true },
        { title: 'Fix refresh logic', done: false },
        { title: 'Add regression test', done: false },
      ],
      activity: [{ at: '10:42', what: 'Created' }, { at: '11:03', what: 'Added #bug' }],
    },
    {
      id: 't2',
      title: 'Review CLI API',
      state: 'completed',
      projectId: 'scena',
      tags: ['design'],
      due: 'today',
      priority: 'normal',
      description: 'Names, defaults, and what happens with no arguments.',
      subtasks: [],
      activity: [{ at: '09:10', what: 'Created' }, { at: '15:22', what: 'Completed' }],
    },
    {
      id: 't3',
      title: 'Write documentation',
      state: 'active',
      projectId: 'scena',
      tags: ['design'],
      due: 'today',
      priority: 'normal',
      description: 'One line per paragraph. No hard wrapping.',
      subtasks: [],
      activity: [{ at: '09:12', what: 'Created' }],
    },
    {
      id: 't4',
      title: 'Release package',
      state: 'active',
      projectId: 'scena',
      tags: [],
      due: 'today',
      priority: 'low',
      description: '',
      subtasks: [],
      activity: [{ at: '09:15', what: 'Created' }],
    },
    {
      id: 't5',
      title: 'Plan the migration',
      state: 'active',
      projectId: 'keepr',
      tags: ['backend'],
      due: 'upcoming',
      priority: 'normal',
      description: 'Which tables move first, and what reads them meanwhile.',
      subtasks: [{ title: 'List the readers', done: false }],
      activity: [{ at: '08:00', what: 'Created' }],
    },
    {
      id: 't6',
      title: 'Archive the old exporter',
      state: 'archived',
      projectId: 'keepr',
      tags: [],
      due: 'none',
      priority: 'low',
      description: '',
      subtasks: [],
      activity: [{ at: '08:05', what: 'Created' }, { at: '08:30', what: 'Archived' }],
    },
    {
      id: 't7',
      title: 'Answer the support thread',
      state: 'active',
      projectId: 'advisor',
      tags: ['bug'],
      due: 'upcoming',
      priority: 'high',
      description: 'Two customers, same symptom, different versions.',
      subtasks: [],
      activity: [{ at: '07:40', what: 'Created' }],
    },
  ],
};

/**
 * Defaults, not a reset.
 *
 * Seeding runs at boot and hydration runs after it, so a file on disk lands on
 * top of this and wins. An empty workspace gets something to look at; a real
 * one gets what it had.
 */
export function seed(store: ReactiveStore): void {
  store.set('$/todo/now' as BindingPath, '12:00');
  store.set(TASKS, Object.fromEntries(SEED.tasks.map((t) => [t.id, t])));
  store.set(PROJECTS, Object.fromEntries(SEED.projects.map((p) => [p.id, p])));
  store.set(SETTINGS, { showCompleted: true, confirmDelete: true });
  store.set(QUERY, '');
}
