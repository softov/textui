import {
  Badge, Column, EmptyState, Field, Form, FormActions, KeyValue, List, Panel,
  Row, SearchBox, Select, Switch, TextInput,
  defineComponent, useApp, useForm, useScreen, useStoreSubtree, useStoreValue,
} from '@textui/core';
import type { ListItem, RenderOutput } from '@textui/core';
import { TaskDetail, TaskList } from './components.js';
import {
  DEFAULT_VIEW, PROJECTS, QUERY, SETTINGS, TASKS, VIEW, getProject, getTask, now,
  projects, searchTasks, setView, settings, tags, tasksIn, viewTitle, writeTask,
  type Due, type Task, type View,
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
 * List, with the detail beside it.
 *
 * Master and detail in one screen because they move together: the detail is
 * about the selected row, and a selection that survived navigating away would
 * be a selection pointing at a list nobody can see.
 */
export const TaskListPage: (props: Record<string, never>) => RenderOutput = defineComponent<Record<string, never>>('TaskListPage', () => {
  const app = useApp();
  useStoreSubtree(PROJECTS);
  useStoreSubtree(TASKS);
  // The sidebar writes the view and this reads it. No parameter, because the
  // filter is not a place you navigated to - it is the state of one screen.
  const view = useStoreValue<View>(VIEW, DEFAULT_VIEW) ?? DEFAULT_VIEW;
  const selected = useStoreValue<string | null>('$/todo/ui/selected', null);

  return (
    <Row flex={1} gap={1}>
      <TaskList
        title={viewTitle(app.store, view)}
        selectedId={selected ?? null}
        onSelect={(id: string) => app.store.set('$/todo/ui/selected', id === '' ? null : id)}
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
    meta: `${tasksIn(app.store, { status: 'all', project: project.id, tag: null }).length} open`,
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
        <Badge label={`${tasksIn(app.store, { status: 'all', project: projectId, tag: null }).length} open`} tone="muted" />
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
            view={{ status: 'all', project: projectId, tag: null }}
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
              items={tasksIn(app.store, { status: 'all', project: projectId, tag: null })
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
        items={tags(app.store).map((tag) => ({
          id: tag,
          label: `#${tag}`,
          meta: String(tasksIn(app.store, { status: 'all', tag, project: null }).length),
        }))}
        flex={1}
        emptyMessage="No tags"
        onActivate={(tag: string) => {
          setView(app.store, { tag });
          app.screens.replace('tasks');
        }}
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
        tasks={searchTasks(app.store, query)}
        title={query === '' ? 'Type to search' : `${query}`}
        onOpen={(id: string) => app.screens.push('task', { taskId: id })}
        flex={1}
      />
    </Column>
  );
});

/**
 * Editing a task.
 *
 * A screen rather than a dialog, because there are six things to change and a
 * dialog that tall is a screen with a border. It takes the task's id the same
 * way the detail page does, and it writes on submit rather than as you type:
 * a form is the one place where "not yet" is a real state, and cancelling has
 * to mean the task is as it was.
 */
export const EditTaskPage: (props: { taskId?: string }) => RenderOutput = defineComponent<{ taskId?: string }>('EditTaskPage', (props) => {
  const app = useApp();
  const screen = useScreen<{ taskId?: string }>();
  const taskId = props.taskId ?? screen.params.taskId ?? '';
  useStoreSubtree(PROJECTS);

  const task = getTask(app.store, taskId);
  if (!task) return <EmptyState title="No such task" flex={1} />;

  const names = projects(app.store);
  const form = useForm({
    initialValues: {
      title: task.title,
      description: task.description,
      project: task.projectId ?? '',
      priority: task.priority as string,
      due: task.due as string,
      tags: task.tags.join(' '),
    },
    validate: (values) => (String(values.title).trim() === ''
      ? { title: 'A task needs a title' }
      : {}),
    onSubmit: (values) => {
      writeTask(app.store, {
        ...task,
        title: String(values.title).trim(),
        description: String(values.description),
        projectId: values.project === '' ? null : String(values.project),
        priority: values.priority as Task['priority'],
        due: values.due as Due,
        // Typed with or without the hash, because both are what people type.
        tags: String(values.tags)
          .split(/[\s,]+/)
          .map((tag) => tag.replace(/^#/, '').trim())
          .filter((tag) => tag !== ''),
        activity: [...task.activity, { at: now(app.store), what: 'Edited' }],
      });
      app.screens.pop();
    },
  });

  return (
    <Panel title={`Edit ${task.title}`} flex={1}>
      {/*
        * Borderless controls, because six bordered ones are eighteen rows and
        * the buttons end up below the fold - a form whose Save you cannot see
        * is a form nobody completes.
        */}
      <Form form={form} gap={0}>
        <Field name="title" label="Title" labelWidth={12} required>
          <TextInput
            value={String(form.values.title)}
            onChange={(v: string) => form.setValue('title', v)}
            border="none"
            autoFocus
          />
        </Field>
        <Field name="description" label="Description" labelWidth={12}>
          <TextInput
            value={String(form.values.description)}
            onChange={(v: string) => form.setValue('description', v)}
            border="none"
          />
        </Field>
        <Field name="project" label="Project" labelWidth={12}>
          <Select
            value={String(form.values.project)}
            options={[{ value: '', label: 'None' },
              ...names.map((p) => ({ value: p.id, label: p.name }))]}
            onChange={(v: string) => form.setValue('project', v)}
            border="none"
          />
        </Field>
        <Field name="priority" label="Priority" labelWidth={12}>
          <Select
            value={String(form.values.priority)}
            options={PRIORITIES.map((v) => ({ value: v, label: v }))}
            onChange={(v: string) => form.setValue('priority', v)}
            border="none"
          />
        </Field>
        <Field name="due" label="Due" labelWidth={12}>
          <Select
            value={String(form.values.due)}
            options={DUES.map((v) => ({ value: v, label: v }))}
            onChange={(v: string) => form.setValue('due', v)}
            border="none"
          />
        </Field>
        <Field name="tags" label="Tags" labelWidth={12} hint="Separated by spaces">
          <TextInput
            value={String(form.values.tags)}
            onChange={(v: string) => form.setValue('tags', v)}
            border="none"
          />
        </Field>
        <FormActions submitLabel="Save" cancelLabel="Cancel" onCancel={() => app.screens.pop()} />
      </Form>
    </Panel>
  );
});

const PRIORITIES = ['high', 'normal', 'low'];
const DUES = ['none', 'today', 'upcoming'];

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
