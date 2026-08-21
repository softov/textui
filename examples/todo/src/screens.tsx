import {
  Badge, Column, EmptyState, KeyValue, List, Panel, Row, SearchBox, Switch,
  defineComponent, useApp, useScreen, useStoreSubtree, useStoreValue,
} from '@textui/core';
import type { ListItem, ReactiveStore, RenderOutput } from '@textui/core';
import { TaskDetail, TaskList } from './components.js';
import {
  PROJECTS, QUERY, SETTINGS, TASKS, getProject, projects, settings, tags, tasksIn,
  type Due, type Filter, type TaskState,
} from './data.js';

/**
 * The pages.
 *
 * Five shapes, and every page is one of them: a list, a detail, a collection
 * that holds lists, a search, and settings. Adding "notes" to a project is a
 * tab inside a page that already exists; adding "someday" is a filter. Neither
 * is a new kind of screen, which is the point of there being only five.
 */

/**
 * The sidebar's view names, mapped onto what the list actually filters by.
 *
 * A project and a tag are views of the same list, not places of their own -
 * which is the point. Selecting `Advisor` in the sidebar should filter the
 * tasks in front of you, the way `Today` does; being sent somewhere with a
 * different shape instead is how you lose the thing you were looking at.
 *
 * One string, because the view is a screen *parameter*: it has to survive
 * being written into `$/layout/screen/params` and read back, and a name does
 * that where a predicate does not.
 */
function filterFor(store: ReactiveStore, view: string): { filter: Filter; title: string } {
  if (view.startsWith('project:')) {
    const projectId = view.slice('project:'.length);
    return {
      filter: { kind: 'project', projectId },
      title: getProject(store, projectId)?.name ?? projectId,
    };
  }
  if (view.startsWith('tag:')) {
    const tag = view.slice('tag:'.length);
    return { filter: { kind: 'tag', tag }, title: `#${tag}` };
  }
  if (view === 'today') return { filter: { kind: 'due', due: 'today' as Due }, title: 'Today' };
  if (view === 'upcoming') return { filter: { kind: 'due', due: 'upcoming' as Due }, title: 'Upcoming' };
  if (view === 'completed') return { filter: { kind: 'state', state: 'completed' as TaskState }, title: 'Completed' };
  if (view === 'archived') return { filter: { kind: 'state', state: 'archived' as TaskState }, title: 'Archived' };
  return { filter: { kind: 'all' }, title: 'Inbox' };
}

/**
 * List, with the detail beside it.
 *
 * Master and detail in one screen because they move together: the detail is
 * about the selected row, and a selection that survived navigating away would
 * be a selection pointing at a list nobody can see.
 */
export const TaskListPage: (props: { view?: string }) => RenderOutput = defineComponent<{ view?: string }>('TaskListPage', (props) => {
  const app = useApp();
  const screen = useScreen<{ view?: string }>();
  useStoreSubtree(PROJECTS);
  const { filter, title } = filterFor(app.store, props.view ?? screen.params.view ?? 'all');
  const selected = useStoreValue<string | null>('$/todo/ui/selected', null);

  return (
    <Row flex={1} gap={1}>
      <TaskList
        filter={filter}
        title={title}
        selectedId={selected ?? null}
        onSelect={(id: string) => app.store.set('$/todo/ui/selected', id)}
        onOpen={(id: string) => app.screens.push('task', { taskId: id })}
        flex={1}
      />
      <Panel title="Details" width={34}>
        <TaskDetail taskId={selected ?? null} />
      </Panel>
    </Row>
  );
});

/**
 * Detail, as a page.
 *
 * The same task the side panel shows, with everything that did not fit. It
 * takes `taskId` as a prop - the screen was pushed with it - which is the
 * readable way for a page to say what it is about.
 */
export const TaskPage: (props: { taskId?: string }) => RenderOutput = defineComponent<{ taskId?: string }>('TaskPage', (props) => {
  const screen = useScreen<{ taskId?: string }>();
  const taskId = props.taskId ?? screen.params.taskId ?? null;

  return (
    <Panel title="Task" flex={1}>
      <TaskDetail taskId={taskId} full />
    </Panel>
  );
});

/** Collection: a list of things that each hold a list. */
export const ProjectListPage: (props: Record<string, never>) => RenderOutput = defineComponent<Record<string, never>>('ProjectListPage', () => {
  const app = useApp();
  useStoreSubtree(PROJECTS);
  useStoreSubtree(TASKS);

  const items: ListItem[] = projects(app.store).map((project) => ({
    id: project.id,
    label: project.name,
    meta: `${tasksIn(app.store, { kind: 'project', projectId: project.id }).length} open`,
    ...(project.notes ? { description: project.notes } : {}),
  }));

  return (
    <Panel title="Projects" flex={1}>
      <List
        items={items}
        flex={1}
        emptyMessage="No projects"
        onActivate={(id: string) => app.screens.push('project', { projectId: id })}
      />
    </Panel>
  );
});

/**
 * One project, with its own views.
 *
 * Tasks, notes and activity are tabs inside a page rather than three screens.
 * They are three ways of looking at one thing, and the back key should leave
 * the project rather than walk backwards through how you looked at it.
 */
export const ProjectPage: (props: { projectId?: string }) => RenderOutput = defineComponent<{ projectId?: string }>('ProjectPage', (props) => {
  const app = useApp();
  const screen = useScreen<{ projectId?: string }>();
  const projectId = props.projectId ?? screen.params.projectId ?? '';
  const tab = useStoreValue<string>('$/screen.project/tab', 'tasks') ?? 'tasks';
  useStoreSubtree(PROJECTS);

  const project = getProject(app.store, projectId);
  if (!project) return <EmptyState title="No such project" flex={1} />;

  const tabs: ListItem[] = [
    { id: 'tasks', label: 'Tasks' },
    { id: 'notes', label: 'Notes' },
    { id: 'activity', label: 'Activity' },
  ];

  return (
    <Column flex={1} gap={1}>
      <Row gap={1}>
        <text content={project.name} bold />
        <Badge label={`${tasksIn(app.store, { kind: 'project', projectId }).length} open`} tone="muted" />
      </Row>
      <Row flex={1} gap={1}>
        <List
          items={tabs}
          width={14}
          selectedId={tab}
          // The tab lives in the screen's own store scope, so it is forgotten
          // when the screen is popped - which is what a scope is for.
          onSelect={(id: string) => app.store.set('$/screen.project/tab', id)}
        />
        {tab === 'tasks' ? (
          <TaskList
            filter={{ kind: 'project', projectId }}
            title="Tasks"
            onOpen={(id: string) => app.screens.push('task', { taskId: id })}
            flex={1}
          />
        ) : tab === 'notes' ? (
          <Panel title="Notes" flex={1}>
            <text content={project.notes || 'Nothing written down.'} wrap="word" />
          </Panel>
        ) : (
          <Panel title="Activity" flex={1}>
            <KeyValue
              items={tasksIn(app.store, { kind: 'project', projectId })
                .flatMap((task) => task.activity.map((entry) => ({
                  label: entry.at,
                  value: `${entry.what} - ${task.title}`,
                })))}
            />
          </Panel>
        )}
      </Row>
    </Column>
  );
});

/** Every tag, and what is under it. */
export const TagListPage: (props: Record<string, never>) => RenderOutput = defineComponent<Record<string, never>>('TagListPage', () => {
  const app = useApp();
  useStoreSubtree(TASKS);

  return (
    <Panel title="Tags" flex={1}>
      <List
        items={tags(app.store).map(({ tag, count }) => ({ id: tag, label: `#${tag}`, meta: String(count) }))}
        flex={1}
        emptyMessage="No tags"
        // A tag has nothing behind it but its tasks, so opening one is the
        // same as filtering by it. A "tag page" would be this list with a
        // heading.
        onActivate={(tag: string) => app.screens.replace('tasks', { view: `tag:${tag}` })}
      />
    </Panel>
  );
});

/**
 * Search.
 *
 * The query is in the store rather than in this component, so leaving the
 * screen and coming back finds what you typed - and so the palette can run
 * "search for this" without going through the field.
 */
export const SearchPage: (props: Record<string, never>) => RenderOutput = defineComponent<Record<string, never>>('SearchPage', () => {
  const app = useApp();
  const query = useStoreValue<string>(QUERY, '') ?? '';

  return (
    <Column flex={1} gap={1}>
      <SearchBox
        value={query}
        placeholder="Search tasks"
        autoFocus
        onChange={(next: string) => app.store.set(QUERY, next)}
      />
      <TaskList
        filter={{ kind: 'search', query }}
        title={query === '' ? 'Type to search' : `${query}`}
        onOpen={(id: string) => app.screens.push('task', { taskId: id })}
        flex={1}
      />
    </Column>
  );
});

export const SettingsPage: (props: Record<string, never>) => RenderOutput = defineComponent<Record<string, never>>('SettingsPage', () => {
  const app = useApp();
  useStoreSubtree(SETTINGS);
  const current = settings(app.store);

  return (
    <Panel title="Settings" flex={1}>
      <Column gap={1}>
        <Switch
          label="Show completed tasks in Inbox"
          value={current.showCompleted}
          onChange={(next: boolean) => app.store.set(SETTINGS, { ...current, showCompleted: next })}
        />
        <Switch
          label="Ask before deleting"
          value={current.confirmDelete}
          onChange={(next: boolean) => app.store.set(SETTINGS, { ...current, confirmDelete: next })}
        />
        <text content="Settings are in the store like everything else, so a theme change and a preference are the same kind of write." fg="muted" wrap="word" />
      </Column>
    </Panel>
  );
});
