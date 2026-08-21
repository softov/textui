import {
  Badge, Column, EmptyState, KeyValue, List, Panel, Row, Timeline,
  defineComponent, useApp, useStoreSubtree, useTheme,
} from '@textui/core';
import type { BoxProps, ListItem, RenderOutput } from '@textui/core';
import {
  PROJECTS, TASKS, getProject, getTask, projects, tags, tasksIn, toggleTask,
  type Filter, type Task,
} from './data.js';

/**
 * The pieces every page is made of.
 *
 * None of them take the data as a prop. They read the store and subscribe to
 * the subtree they read, so a task completed on the detail page redraws in the
 * list behind it without either page knowing the other is open. Passing the
 * list down instead would work exactly until two screens showed it at once.
 */

const BOX = { done: '[x]', open: '[ ]' };

function rowFor(store: ReturnType<typeof useApp>['store'], task: Task): ListItem {
  const project = task.projectId ? getProject(store, task.projectId) : undefined;
  const meta = [project?.name, ...task.tags.map((t) => `#${t}`)].filter(Boolean).join('  ');
  return {
    id: task.id,
    label: `${task.state === 'completed' ? BOX.done : BOX.open} ${task.title}`,
    ...(meta ? { meta } : {}),
    ...(task.priority === 'high' && task.state === 'active' ? { tone: 'danger' as const } : {}),
    ...(task.state === 'completed' ? { tone: 'muted' as const } : {}),
  };
}

export interface TaskListProps extends BoxProps {
  filter: Filter;
  selectedId?: string | null;
  onSelect?(id: string): void;
  onOpen?(id: string): void;
  title?: string;
  autoFocus?: boolean;
}

export const TaskList: (props: TaskListProps) => RenderOutput = defineComponent<TaskListProps>('TaskList', (props) => {
  const app = useApp();
  const { filter, selectedId, onSelect, onOpen, title, autoFocus: _autoFocus, ...rest } = props;
  // Subscribing to the subtree is what makes this a live list: any write under
  // `$/todo/tasks` redraws it, and every mutation is a whole-task write.
  useStoreSubtree(TASKS);

  const items = tasksIn(app.store, filter).map((task) => rowFor(app.store, task));

  return (
    <Panel title={title ?? 'Tasks'} flex={1} {...rest}>
      <List
        items={items}
        flex={1}
        {...(selectedId ? { selectedId } : {})}
        emptyMessage="Nothing here"
        onSelect={(id: string) => onSelect?.(id)}
        onActivate={(id: string) => onOpen?.(id)}
      />
    </Panel>
  );
});

export interface TaskDetailProps extends BoxProps {
  taskId: string | null;
  /** Everything, rather than the summary a side panel has room for. */
  full?: boolean;
}

export const TaskDetail: (props: TaskDetailProps) => RenderOutput = defineComponent<TaskDetailProps>('TaskDetail', (props) => {
  const app = useApp();
  const theme = useTheme();
  useStoreSubtree(TASKS);

  const { taskId, full, ...rest } = props;
  const task = taskId ? getTask(app.store, taskId) : undefined;
  if (!task) {
    return <EmptyState title="No task selected" message="Choose one on the left." flex={1} {...rest} />;
  }

  const project = task.projectId ? getProject(app.store, task.projectId) : undefined;
  const facts = [
    { label: 'Project', value: project?.name ?? '—' },
    { label: 'Due', value: task.due === 'none' ? '—' : task.due },
    { label: 'Priority', value: task.priority },
    { label: 'Tags', value: task.tags.map((t) => `#${t}`).join(' ') || '—' },
    { label: 'State', value: task.state },
  ];

  return (
    <Column flex={1} gap={1} {...rest}>
      <Row gap={1}>
        <text content={task.title} bold flex={1} wrap="word" />
        <Badge label={task.state === 'completed' ? 'done' : task.state} tone={task.state === 'completed' ? 'success' : 'muted'} />
      </Row>
      <KeyValue items={facts} />

      {task.description !== '' ? (
        <Column gap={0}>
          <text content="Description" fg="muted" />
          <box height={1} fill={theme.borderChars().top} fg="borderSubtle" />
          <text content={task.description} wrap="word" />
        </Column>
      ) : null}

      {full && task.subtasks.length > 0 ? (
        <Column gap={0}>
          <text content="Subtasks" fg="muted" />
          {task.subtasks.map((sub, i) => (
            <text key={i} content={`${sub.done ? BOX.done : BOX.open} ${sub.title}`} />
          ))}
        </Column>
      ) : null}

      {full ? (
        <Column gap={0} flex={1}>
          <text content="Activity" fg="muted" />
          <Timeline
            items={task.activity.map((entry, i) => ({
              id: String(i),
              title: entry.what,
              timestamp: entry.at,
            }))}
          />
        </Column>
      ) : null}
    </Column>
  ) as RenderOutput;
});

/**
 * The navigation.
 *
 * It is mounted on the `sidebar` surface rather than being part of a screen,
 * which is the whole distinction: the pages change under it and it does not
 * remount, so the thing you are navigating with survives navigating.
 */
export const Nav: (props: Record<string, never>) => RenderOutput = defineComponent<Record<string, never>>('Nav', () => {
  const app = useApp();
  useStoreSubtree(TASKS);
  useStoreSubtree(PROJECTS);
  const current = app.screens.current();

  const count = (filter: Filter): string => String(tasksIn(app.store, filter).length);

  const items: ListItem[] = [
    { id: 'view:all', label: 'Inbox', meta: count({ kind: 'all' }) },
    { id: 'view:today', label: '  Today', meta: count({ kind: 'due', due: 'today' }) },
    { id: 'view:upcoming', label: '  Upcoming', meta: count({ kind: 'due', due: 'upcoming' }) },
    { id: 'view:completed', label: '  Completed', meta: count({ kind: 'state', state: 'completed' }) },
    { id: 'view:archived', label: '  Archived', meta: count({ kind: 'state', state: 'archived' }) },
    { id: 'nav:projects', label: 'Projects', meta: String(projects(app.store).length) },
    ...projects(app.store).map((project) => ({
      id: `project:${project.id}`,
      label: `  ${project.name}`,
      meta: count({ kind: 'project', projectId: project.id }),
    })),
    { id: 'nav:tags', label: 'Tags', meta: String(tags(app.store).length) },
    ...tags(app.store).map(({ tag, count: n }) => ({
      id: `tag:${tag}`,
      label: `  #${tag}`,
      meta: String(n),
    })),
    { id: 'nav:search', label: 'Search' },
    { id: 'nav:settings', label: 'Settings' },
  ];

  return (
    <List
      items={items}
      flex={1}
      selectedId={selectionFor(current?.id ?? null, current?.params ?? {})}
      onActivate={(id: string) => go(app, id)}
    />
  );
});

/** Which nav row stands for what is on screen. */
function selectionFor(screen: string | null, params: Record<string, unknown>): string {
  if (screen === 'tasks') return `view:${String(params.view ?? 'all')}`;
  if (screen === 'project') return `project:${String(params.projectId ?? '')}`;
  if (screen === 'tag') return `tag:${String(params.tag ?? '')}`;
  return `nav:${screen ?? ''}`;
}

/**
 * One place that turns a nav row into a screen.
 *
 * `replace` and not `push`: choosing a view in the sidebar is not a step you
 * should have to press escape out of. Opening a task is, and that one pushes.
 */
function go(app: ReturnType<typeof useApp>, id: string): void {
  const [kind, rest] = splitOnce(id, ':');
  if (kind === 'view') app.screens.replace('tasks', { view: rest });
  else if (kind === 'project') app.screens.replace('project', { projectId: rest });
  else if (kind === 'tag') app.screens.replace('tag', { tag: rest });
  else if (rest === 'projects') app.screens.replace('projects');
  else if (rest === 'tags') app.screens.replace('tags');
  else if (rest === 'search') app.screens.replace('search');
  else if (rest === 'settings') app.screens.replace('settings');
}

function splitOnce(text: string, separator: string): [string, string] {
  const at = text.indexOf(separator);
  return at === -1 ? [text, ''] : [text.slice(0, at), text.slice(at + 1)];
}

export { toggleTask };
