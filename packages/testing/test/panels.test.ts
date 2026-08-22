import { describe, expect, it } from 'vitest';
import { render, renderApp } from '../src/index.js';
import type { ComponentDefinition, Resource, ResourceProvider, TextUIApp } from '@textui/core';
import {
  PANEL_PATH, ResourcePanel, defaultRenderer, defineComponent, h, kindRendererPath, panelPath,
  panelStatusPath, panelViewPath, useFocus, useInput, useStoreValue, usePanelState,
  usePanelStatus,
} from '@textui/core';

/**
 * Panels.
 *
 * A resource is a thing; a panel is a place one is shown; the renderer is a
 * late choice between whatever is registered for its kind. These are the three
 * promises that separation makes: the list of ways to open something comes
 * from the registry rather than from the host, a panel remembers where it was
 * looking without the renderer implementing anything, and two panels showing
 * one resource are two places rather than one.
 */

const LINES = Array.from({ length: 40 }, (_, i) => `line ${i + 1}`).join('\n');

const FILES: Record<string, string> = {
  'mem:/long.txt': LINES,
  'mem:/other.txt': 'other one\nother two\nother three\n',
};

function memory(): ResourceProvider {
  return {
    scheme: 'mem',
    stat: async (uri) => (FILES[uri] === undefined ? null : ({
      uri,
      kind: 'unknown',
      metadata: { name: uri.split('/').pop() ?? uri, size: FILES[uri]?.length ?? 0 },
      capabilities: ['read', 'write'],
    } as Resource)),
    read: async (uri) => FILES[uri] ?? '',
    write: async (uri, content) => { FILES[uri] = String(content); },
  };
}

/**
 * A viewer with somewhere to be: a window over the file, moved by the arrows.
 *
 * It implements nothing to be remembered. `usePanelState` is where the offset
 * lives, and that is the whole of what a renderer does to get its place back.
 */
const ROWS = 6;
const Lines = defineComponent<{ uri?: string }>('Lines', ({ uri }) => {
  const focus = useFocus({});
  const [view, setView] = usePanelState({ top: 0 });
  const lines = (FILES[uri ?? ''] ?? '').split('\n');
  const maxTop = Math.max(0, lines.length - ROWS);

  useInput((event) => {
    if (event.name === 'down') { setView({ top: Math.min(maxTop, view.top + 1) }); return true; }
    if (event.name === 'up') { setView({ top: Math.max(0, view.top - 1) }); return true; }
    return false;
  }, { focusId: focus.id });

  return h('box', { id: focus.id, direction: 'column', flex: 1 },
    ...lines.slice(view.top, view.top + ROWS)
      .map((line, i) => h('text', { key: String(i), content: line })));
});

/** A renderer that writes back, so "which one saves" has an answer. */
const FakeEditor = defineComponent<{ uri?: string }>('FakeEditor', ({ uri }) =>
  h('text', { content: `EDITING ${uri ?? ''}` }));

/** A renderer that keeps something of its own in the panel's record. */
const Marker = defineComponent<{ uri?: string }>('Marker', () => {
  const [view, setView] = usePanelState({ n: 0 });
  usePanelStatus(view.n > 0 ? `marked ${view.n}` : null);
  return h('box', {
    focusable: true,
    onKey: (event: { name: string }) => {
      if (event.name !== 'x') return false;
      setView({ n: view.n + 1 });
      return true;
    },
  }, h('text', { content: `n=${view.n}` }));
});

const EXTRA: ComponentDefinition[] = [
  {
    component: 'Lines',
    renderer: { kind: 'function', render: Lines },
    description: 'A window over a file, moved by the arrows.',
  },
  {
    component: 'FakeEditor',
    renderer: { kind: 'function', render: FakeEditor },
    description: 'Stands in for an editor.',
  },
  {
    component: 'Marker',
    renderer: { kind: 'function', render: Marker },
    description: 'Keeps a number in the panel record.',
  },
  {
    component: 'LoudViewer',
    renderer: { kind: 'function', render: defineComponent('LoudViewer', () => h('text', { content: 'LOUD' })) },
    opens: { resourceKinds: ['file.text'], title: 'Loud', priority: 5 },
    description: 'Registered by declaring `opens` rather than as a viewer.',
  },
];

function boot(app: TextUIApp): void {
  app.resources.registerProvider(memory());
  app.resources.registerKind({ id: 'file', title: 'File' });
  app.resources.registerKind({ id: 'file.text', title: 'Text', extends: 'file', extensions: ['*.txt'] });
  app.resources.registerViewer({
    id: 'plain', title: 'Plain', kinds: ['file.text'], component: 'Lines', priority: 10,
  });
  app.resources.registerEditor({
    id: 'edit', title: 'Editor', kinds: ['file.text'], component: 'FakeEditor', saves: true, priority: 100,
  });
  app.resources.registerViewer({
    id: 'marker', title: 'Marker', kinds: ['file.text'], component: 'Marker', priority: 1,
  });
}

/** A panel whose resource comes from the store, so a test can switch it. */
const Host = defineComponent<{ id: string }>('PanelHost', ({ id }) => {
  const uri = useStoreValue<string>(`$/ui/test/${id}`, 'mem:/long.txt');
  return h(ResourcePanel, { id, uri: uri ?? null, autoFocus: id === 'left', flex: 1 });
});

async function panel(ids: string[] = ['left']) {
  const t = await render(
    h('box', { direction: 'row', flex: 1 }, ...ids.map((id) => h(Host, { id, key: id }))),
    { width: 60, height: 12, components: EXTRA, onBoot: boot },
  );
  const quiet = async (): Promise<void> => {
    for (let i = 0; i < 8; i++) { await t.settle(); t.advance(20); t.flush(); }
  };
  await quiet();
  return { t, quiet };
}

describe('what can open a resource', () => {
  it('is one list, however the renderers were registered', async () => {
    const t = await renderApp({ components: EXTRA, onBoot: boot });

    const renderers = t.app.resources.renderersFor('file.text');
    expect(renderers.map((r) => r.id)).toEqual(['edit', 'plain', 'LoudViewer', 'marker']);
    // An editor, a viewer and a component that declared `opens` - three
    // registries, one answer, ordered by priority rather than by which list
    // they arrived in.
    expect(renderers.map((r) => r.saves)).toEqual([true, false, false, false]);
    await t.unmount();
  });

  it('opens as the best one that does not write back', async () => {
    const t = await renderApp({ components: EXTRA, onBoot: boot });
    const renderers = t.app.resources.renderersFor('file.text');

    // The editor has the higher priority and still does not win: opening a
    // file is looking at it, and editing is something you ask for.
    expect(defaultRenderer(renderers)?.id).toBe('plain');
    expect(defaultRenderer(renderers.filter((r) => r.id === 'edit'))?.id).toBe('edit');
    expect(defaultRenderer([])).toBeNull();
    await t.unmount();
  });

  it('is offered as a command only while a panel exists', async () => {
    const bare = await renderApp({ components: EXTRA, onBoot: boot });
    expect(bare.app.commands.enabled('panel.openWith')).toBe(false);
    await bare.unmount();

    const { t } = await panel();
    expect(t.app.commands.enabled('panel.openWith')).toBe(true);
    await t.unmount();
  });
});

describe('a panel remembers where it was looking', () => {
  it('per resource, so switching away and back lands in the same place', async () => {
    const { t, quiet } = await panel();
    const uri = 'mem:/long.txt';

    const initial = t.text();
    for (let i = 0; i < 20; i++) t.press('down');
    await quiet();
    const scrolled = t.text();
    const kept = t.store.get<{ state?: { top?: number } }>(panelViewPath('left', uri));
    expect(kept?.state?.top, 'where it is looking went into the panel record').toBeGreaterThan(10);
    expect(scrolled, 'and the pane scrolled').not.toBe(initial);

    t.store.set('$/ui/test/left', 'mem:/other.txt');
    await quiet();
    expect(t.hasText('other one')).toBe(true);

    t.store.set('$/ui/test/left', uri);
    await quiet();
    expect(t.text(), 'back where it was, not back at the top').toBe(scrolled);
    await t.unmount();
  });

  it('and each panel remembers its own', async () => {
    const { t, quiet } = await panel(['left', 'right']);

    for (let i = 0; i < 20; i++) t.press('down');
    await quiet();

    const left = t.store.get<{ state?: { top?: number } }>(panelViewPath('left', 'mem:/long.txt'));
    const right = t.store.get<{ state?: { top?: number } }>(panelViewPath('right', 'mem:/long.txt'));
    expect(left?.state?.top).toBeGreaterThan(10);
    // The same file in the other half of a split is a second place to look
    // from, not a second view of one place.
    expect(right?.state?.top ?? 0).toBe(0);
    await t.unmount();
  });

  it('and forgets when the panel was never given a name', async () => {
    const t = await render(
      h(ResourcePanel, { uri: 'mem:/long.txt', autoFocus: true, flex: 1 }),
      { width: 60, height: 12, components: EXTRA, onBoot: boot },
    );
    for (let i = 0; i < 10; i++) { await t.settle(); t.advance(20); t.flush(); }

    const id = t.store.get<string>(PANEL_PATH);
    expect(id, 'an unnamed panel still publishes itself').not.toBeNull();
    expect(t.store.get(panelPath(id as string))).toBeTruthy();

    await t.unmount();
    // Its id was invented for that mount, so what it remembered could never be
    // found again - it goes with it rather than piling up in the store.
    expect(t.store.get(panelPath(id as string))).toBeFalsy();
  });
});

describe('choosing how to open something', () => {
  it('sticks to the file, and teaches the kind', async () => {
    const { t, quiet } = await panel();
    expect(t.hasText('line 1')).toBe(true);

    await t.app.execute('panel.openWith', { renderer: 'Editor' });
    await quiet();
    expect(t.hasText('EDITING mem:/long.txt')).toBe(true);
    expect(t.store.get<{ renderer?: string }>(panelViewPath('left', 'mem:/long.txt'))?.renderer)
      .toBe('edit');
    // Twice: against the file, and against what the file is. Somebody who
    // opens one text file as source is usually saying something about text
    // files rather than about that one.
    expect(t.store.get(kindRendererPath('file.text'))).toBe('edit');

    // Away and back: the choice belongs to this panel and this file, so it
    // survives the panel being pointed somewhere else.
    t.store.set('$/ui/test/left', 'mem:/other.txt');
    await quiet();
    expect(t.hasText('EDITING mem:/other.txt'), 'and the next one of its kind').toBe(true);
    t.store.set('$/ui/test/left', 'mem:/long.txt');
    await quiet();
    expect(t.hasText('EDITING mem:/long.txt')).toBe(true);
    await t.unmount();
  });

  it('lets a file disagree with its kind', async () => {
    const { t, quiet } = await panel();
    t.store.set(kindRendererPath('file.text'), 'edit');
    await quiet();
    expect(t.hasText('EDITING mem:/long.txt'), 'the kind decides by default').toBe(true);

    await t.app.execute('panel.openWith', { renderer: 'Plain' });
    await quiet();
    expect(t.hasText('line 1')).toBe(true);

    // The file's own answer outlives the kind's, which is the point of keeping
    // both: "markdown opens rendered, except this one".
    t.store.set(kindRendererPath('file.text'), 'edit');
    await quiet();
    expect(t.hasText('line 1'), 'this one was told otherwise').toBe(true);
    await t.unmount();
  });

  it('cycles through everything registered', async () => {
    const { t, quiet } = await panel();
    const seen: string[] = [];
    for (let i = 0; i < 3; i++) {
      await t.app.execute('panel.nextRenderer');
      await quiet();
      seen.push(t.store.get<{ renderer?: string }>(panelViewPath('left', 'mem:/long.txt'))?.renderer ?? '');
    }
    expect(seen).toEqual(['LoudViewer', 'marker', 'edit']);
    await t.unmount();
  });

  it('goes to the one that writes back, and comes back to the one that does not', async () => {
    const { t, quiet } = await panel();

    await t.app.execute('panel.toggleEdit');
    await quiet();
    expect(t.hasText('EDITING mem:/long.txt')).toBe(true);

    await t.app.execute('panel.toggleEdit');
    await quiet();
    // Not a cycle: the key says "edit / view", so it goes back to what the
    // kind opens as rather than on to the next thing in the list.
    expect(t.hasText('line 1')).toBe(true);
    await t.unmount();
  });

  it('acts on a panel that has not drawn yet, when it is told which', async () => {
    const { t, quiet } = await panel();

    // "Open this and edit it" is two calls in one tick, and the panel
    // publishes what it is showing a frame later. Saying which file and which
    // panel is what makes that work without a wait in between.
    t.store.set('$/ui/test/left', 'mem:/other.txt');
    await t.app.execute('panel.toggleEdit', { panel: 'left', uri: 'mem:/other.txt' });
    await quiet();
    expect(t.hasText('EDITING mem:/other.txt')).toBe(true);
    await t.unmount();
  });
});

describe('what a renderer has to say', () => {
  it('reaches a status bar without the bar knowing what is mounted', async () => {
    const { t, quiet } = await panel();
    await t.app.execute('panel.openWith', { renderer: 'Marker' });
    await quiet();
    expect(t.hasText('n=0')).toBe(true);
    expect(t.store.get(panelStatusPath('left'))).toBeNull();

    t.press('x');
    await quiet();
    expect(t.hasText('n=1')).toBe(true);
    expect(t.store.get(panelStatusPath('left'))).toBe('marked 1');
    await t.unmount();
  });
});
