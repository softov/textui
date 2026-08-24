import type { BoxProps, RenderOutput } from '@textui/core';
import {
  defineComponent,
  useApp,
  useEffect,
  useStoreSubtree,
  useStoreValue,
  useTheme,
} from '@textui/core';
import type { ListItem } from '@textui/widgets';
import {
  Badge,
  Column,
  EmptyState,
  KeyValue,
  List,
  Panel,
  Row,
  ScrollView,
  Timeline,
} from '@textui/widgets';
import {
  DEFAULT_VIEW, PROJECTS, STATUSES, TASKS, VIEW, getProject, getTask, navCounts,
  projects, setView, tasksIn, toggleTask,
  type Status, type Task, type View,
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
  /** Which tasks. Omit to use the view the sidebar is driving. */
  view?: Partial<View>;
  /** An explicit list, for search - which asks its own question. */
  tasks?: Task[];
  selectedId?: string | null;
  onSelect?(id: string): void;
  onOpen?(id: string): void;
  title?: string;
  autoFocus?: boolean;
}

export const TaskList: (props: TaskListProps) => RenderOutput = defineComponent<TaskListProps>('TaskList', (props) => {
  const app = useApp();
  const { view, tasks, selectedId, onSelect, onOpen, title, autoFocus: _autoFocus, ...rest } = props;
  // Subscribing to the subtree is what makes this a live list: any write under
  // `$/todo/tasks` redraws it, and every mutation is a whole-task write.
  useStoreSubtree(TASKS);

  const items = (tasks ?? tasksIn(app.store, view ?? {})).map((task) => rowFor(app.store, task));

  // A list with a highlight on it and nothing selected is a list whose detail
  // panel is empty until you press a key. Changing the filter has the same
  // problem the other way: the selection is a task this view does not show.
  const ids = items.map((item) => item.id).join(',');
  useEffect(() => {
    // An empty list has nothing selected. Leaving the last selection would
    // leave the detail panel describing a task this view does not show.
    if (items.length === 0) {
      if (selectedId) onSelect?.('');
      return;
    }
    if (selectedId && items.some((item) => item.id === selectedId)) return;
    onSelect?.(items[0]?.id as string);
  }, [ids]);

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

  // A panel with more in it than fits is a panel with a hidden bottom half, so
  // it scrolls - and to scroll it has to be somewhere the keyboard can go,
  // which is what makes it the third stop rather than decoration beside two.
  return (
    <ScrollView flex={1} {...rest}>
    <Column gap={1}>
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
    </ScrollView>
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
  const theme = useTheme();
  useStoreSubtree(TASKS);
  useStoreSubtree(PROJECTS);
  const view = useStoreValue<View>(VIEW, DEFAULT_VIEW) ?? DEFAULT_VIEW;

  /**
   * Four blocks, and a row in each says which one that axis is on.
   *
   * Not a tree. A heading is a row nobody can select - `disabled` - so the
   * keyboard steps over it and the same flat list draws blocks with titles.
   * Nothing nests under anything: `PROJECTS` is a title, never somewhere to
   * go, and it has no children in the sense a tree means.
   *
   * Three axes, three markers. The list has one cursor, so which project is
   * *chosen* cannot be the cursor - it is a dot beside the row, and there is
   * one lit in each block at all times.
   */
  const mark = (on: boolean): string => (on ? theme.glyphs.bulletFilled : ' ');

  // Every number on this list, in one pass over the tasks rather than one
  // pass per row. The rows differ only in which axis they hold, and a task's
  // contribution to all of them falls out of the same three booleans.
  const counts = navCounts(app.store, view);

  const LABELS: Record<Status, string> = {
    all: 'All', today: 'Today', upcoming: 'Upcoming',
    completed: 'Completed', archived: 'Archived',
  };

  const items: ListItem[] = [
    { id: 'h:inbox', label: 'INBOX', disabled: true },
    ...STATUSES.map((status) => ({
      id: `status:${status}`,
      label: LABELS[status],
      icon: mark(view.status === status),
      meta: String(counts.status[status]),
    })),

    { id: 'h:projects', label: 'PROJECTS', disabled: true },
    {
      id: 'project:',
      label: 'Any project',
      icon: mark(view.project === null),
      meta: String(counts.project['']),
    },
    ...projects(app.store).map((project) => ({
      id: `project:${project.id}`,
      label: project.name,
      icon: mark(view.project === project.id),
      meta: String(counts.project[project.id] ?? 0),
    })),

    { id: 'h:tags', label: 'TAGS', disabled: true },
    {
      id: 'tag:',
      label: 'Any tag',
      icon: mark(view.tag === null),
      meta: String(counts.tag['']),
    },
    ...counts.tags.map((tag) => ({
      id: `tag:${tag}`,
      label: `#${tag}`,
      icon: mark(view.tag === tag),
      meta: String(counts.tag[tag] ?? 0),
    })),

    { id: 'h:more', label: 'MORE', disabled: true },
    { id: 'go:projects', label: 'Projects' },
    { id: 'go:search', label: 'Search' },
    { id: 'go:settings', label: 'Settings' },
  ];

  return (
    <List
      items={items}
      flex={1}
      marker={false}
      // Enter chooses; moving does not. With one axis, moving could choose -
      // there was nothing to pass over. With three, walking from INBOX down to
      // a project sets every status on the way and arrives with the list
      // already wrong, which is the whole complaint. The dots say what is
      // chosen, so the cursor is free to be somewhere else.
      onActivate={(id: string) => choose(app, id)}
    />
  );
});

/**
 * One row, one axis.
 *
 * Choosing a project narrows what is already on screen rather than replacing
 * it: "Today, in Advisor" is a view somebody wants and there is no reason
 * picking the second should throw away the first. Only the last block
 * navigates, and those are pages rather than filters.
 */
function choose(app: ReturnType<typeof useApp>, id: string): void {
  const [kind, rest] = splitOnce(id, ':');
  if (kind === 'status') setView(app.store, { status: rest as Status });
  else if (kind === 'project') setView(app.store, { project: rest === '' ? null : rest });
  else if (kind === 'tag') setView(app.store, { tag: rest === '' ? null : rest });
  else if (kind === 'go') {
    if (rest === 'projects') app.screens.replace('projects');
    else if (rest === 'search') app.screens.replace('search');
    else if (rest === 'settings') app.screens.replace('settings');
    return;
  }
  // Any filter change is about the list, so it belongs on the list screen.
  if (app.screens.current()?.id !== 'tasks') app.screens.replace('tasks');
}

function splitOnce(text: string, separator: string): [string, string] {
  const at = text.indexOf(separator);
  return at === -1 ? [text, ''] : [text.slice(0, at), text.slice(at + 1)];
}

export { toggleTask };
