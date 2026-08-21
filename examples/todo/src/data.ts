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
export type Filter =
  | { kind: 'all' }
  | { kind: 'due'; due: Due }
  | { kind: 'state'; state: TaskState }
  | { kind: 'project'; projectId: string }
  | { kind: 'tag'; tag: string }
  | { kind: 'search'; query: string };

export function tasksIn(store: ReactiveStore, filter: Filter): Task[] {
  const all = Object.values(store.get<Record<string, Task>>(TASKS) ?? {});
  const live = (t: Task): boolean => t.state !== 'archived';

  switch (filter.kind) {
    case 'all': return all.filter(live);
    case 'due': return all.filter((t) => live(t) && t.due === filter.due);
    case 'state': return all.filter((t) => t.state === filter.state);
    case 'project': return all.filter((t) => live(t) && t.projectId === filter.projectId);
    case 'tag': return all.filter((t) => live(t) && t.tags.includes(filter.tag));
    case 'search': {
      const needle = filter.query.trim().toLowerCase();
      if (needle === '') return [];
      return all.filter((t) =>
        t.title.toLowerCase().includes(needle) ||
        t.description.toLowerCase().includes(needle) ||
        t.tags.some((tag) => tag.toLowerCase().includes(needle)));
    }
    default: return all;
  }
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

/** Every tag in use, with how many tasks use it. */
export function tags(store: ReactiveStore): { tag: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const task of tasksIn(store, { kind: 'all' })) {
    for (const tag of task.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts].map(([tag, count]) => ({ tag, count })).sort((a, b) => a.tag.localeCompare(b.tag));
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
    activity: [...task.activity, { at: stamp(store), what: state === 'completed' ? 'Completed' : 'Reopened' }],
  });
}

export function archiveTask(store: ReactiveStore, id: string): void {
  const task = getTask(store, id);
  if (!task) return;
  writeTask(store, {
    ...task,
    state: 'archived',
    activity: [...task.activity, { at: stamp(store), what: 'Archived' }],
  });
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
    activity: [{ at: stamp(store), what: 'Created' }],
    ...partial,
  };
  writeTask(store, task);
  return task;
}

function nextId(store: ReactiveStore): number {
  const all = Object.keys(store.get<Record<string, Task>>(TASKS) ?? {});
  return all.length + 1;
}

/**
 * A timestamp the example can be tested against.
 *
 * The clock is in the store, so a test can set it and a screenshot of this
 * application is the same screenshot tomorrow. An application with a real
 * clock reads one here instead.
 */
function stamp(store: ReactiveStore): string {
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

export function seed(store: ReactiveStore): void {
  store.set('$/todo/now' as BindingPath, '12:00');
  store.set(TASKS, Object.fromEntries(SEED.tasks.map((t) => [t.id, t])));
  store.set(PROJECTS, Object.fromEntries(SEED.projects.map((p) => [p.id, p])));
  store.set(SETTINGS, { showCompleted: true, confirmDelete: true });
  store.set(QUERY, '');
}
