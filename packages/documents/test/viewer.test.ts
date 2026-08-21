import { describe, expect, it } from 'vitest';
import {
  defineComponent, h, useState, useStore, useStoreValue, notify,
} from '@textui/core';
import type { TextUIApp, Resource, ResourceProvider } from '@textui/core';
import { render, renderApp } from '@textui/testing';
import {
  jsonAdapter, openDocument, getDocument, isDocumentDirty, saveDocument,
  setDocumentContent,
} from '../src/index.js';

/**
 * The file viewer, the document buffer and the adapter that colours them.
 *
 * These are written against a fake provider rather than the real filesystem,
 * so they assert behaviour rather than the contents of this repository.
 */

const SMALL = '{\n  "a": 1\n}';
const BIG = `{\n${Array.from({ length: 4000 }, (_, i) => `  "k${i}": ${i}`).join(',\n')}\n}`;

function memoryProvider(files: Record<string, string>, options: { writable?: boolean } = {}): ResourceProvider {
  return {
    scheme: 'mem',
    async stat(uri): Promise<Resource | null> {
      const content = files[uri];
      if (content === undefined) return null;
      return {
        uri,
        kind: 'unknown',
        metadata: { name: uri.split('/').pop() ?? uri, size: content.length, readonly: !options.writable },
        capabilities: options.writable ? ['read', 'write'] : ['read'],
      };
    },
    async read(uri) {
      const content = files[uri];
      if (content === undefined) throw new Error(`no such resource: ${uri}`);
      return content;
    },
    async write(uri, content) {
      files[uri] = String(content);
    },
  };
}

function setup(files: Record<string, string>, options: { writable?: boolean } = {}) {
  return (app: TextUIApp): void => {
    app.resources.registerProvider(memoryProvider(files, options));
    app.resources.registerKind({ id: 'file', title: 'File' });
    app.resources.registerKind({ id: 'file.data', title: 'Data', extends: 'file' });
    app.registerAdapter(jsonAdapter());
  };
}

describe('CodeViewer', () => {
  it('renders only as many rows as it was given, whatever the file is', async () => {
    const t = await render(
      h('box', { direction: 'column', width: 40, height: 8 },
        h('CodeViewer', { content: BIG, flex: 1 })),
      { width: 40, height: 8 },
    );
    await t.settle();

    // Eight rows of frame, so at most eight rows of file - not four thousand.
    expect(t.lines().filter((l) => l.trim() !== '').length).toBeLessThanOrEqual(8);
    expect(t.hasText('"k0": 0')).toBe(true);
    expect(t.hasText('"k3999"')).toBe(false);
    await t.unmount();
  });

  it('leaves the surrounding layout identical for a short and a huge file', async () => {
    const frame = async (content: string) => {
      const t = await render(
        h('box', { direction: 'column', width: 40, height: 8 },
          h('box', { flex: 1, border: 'single' }, h('CodeViewer', { content, flex: 1 })),
          h('text', { content: 'status bar' })),
        { width: 40, height: 8 },
      );
      await t.settle();
      const out = {
        viewer: t.getByRole('document').rect,
        top: t.line(0),
        status: t.lines().findIndex((l) => l.includes('status bar')),
      };
      await t.unmount();
      return out;
    };

    const small = await frame(SMALL);
    const big = await frame(BIG);

    // Same pane, same frame, same status row - a thousand times the content.
    expect(big.viewer).toEqual(small.viewer);
    expect(big.top).toBe(small.top);
    expect(big.status).toBe(small.status);
  });

  it('scrolls with the keyboard and keeps the gutter aligned', async () => {
    const t = await render(
      h('box', { direction: 'column', width: 40, height: 6 },
        h('CodeViewer', { content: BIG, flex: 1, autoFocus: true })),
      { width: 40, height: 6 },
    );
    await t.settle();
    t.focus(t.getByRole('document').id);

    const first = () => t.line(0).trimStart().startsWith('1 {');
    expect(first()).toBe(true);

    t.press('pagedown');
    await t.settle();
    expect(first()).toBe(false);

    t.press('home');
    await t.settle();
    expect(first()).toBe(true);

    t.press('end');
    await t.settle();
    // The last line of the document, and nothing past it.
    expect(t.text()).toContain('}');
    await t.unmount();
  });

  it('scrolls sideways rather than widening its pane', async () => {
    const long = `x${'-'.repeat(200)}end`;
    const t = await render(
      h('box', { direction: 'column', width: 30, height: 4 },
        h('CodeViewer', { content: long, flex: 1, lineNumbers: false })),
      { width: 30, height: 4 },
    );
    await t.settle();
    t.focus(t.getByRole('document').id);

    expect(t.lines().every((line) => line.length <= 30)).toBe(true);
    expect(t.hasText('end')).toBe(false);

    for (let i = 0; i < 60; i++) t.press('right');
    await t.settle();
    expect(t.hasText('end')).toBe(true);
    expect(t.lines().every((line) => line.length <= 30)).toBe(true);
    await t.unmount();
  });

  it('reports its position to whoever mounted it', async () => {
    const seen: { line: number; lines: number }[] = [];
    const t = await render(
      h('box', { direction: 'column', width: 30, height: 5 },
        h('CodeViewer', {
          content: 'a\nb\nc\nd\ne\nf\ng',
          flex: 1,
          onPosition: (p: { line: number; lines: number }) => seen.push(p),
        })),
      { width: 30, height: 5 },
    );
    await t.settle();
    t.focus(t.getByRole('document').id);
    t.press('down');
    await t.settle();

    expect(seen.at(-1)?.lines).toBe(7);
    expect(seen.at(-1)?.line).toBe(2);
    await t.unmount();
  });
});

describe('syntax highlighting', () => {
  it('colours JSON once the adapter is registered', async () => {
    const files = { 'mem:///config.json': '{"name": "value"}' };
    const t = await renderApp({
      width: 40, height: 6,
      onBoot: (app) => {
        setup(files)(app);
        app.open({
          surface: 'main',
          key: 'v',
          target: h('JsonViewer', { uri: 'mem:///config.json', flex: 1 }),
        });
      },
    });
    for (let i = 0; i < 6; i++) await t.settle();

    const row = t.line(0);
    expect(row).toContain('"name"');

    const buffer = t.app.buffer();
    const colourAt = (text: string) => {
      const x = row.indexOf(text);
      return JSON.stringify(buffer.get(x, 0)?.fg);
    };
    // The key and the value are different colours, and neither is the default.
    expect(colourAt('"name"')).not.toBe(colourAt('"value"'));
    expect(colourAt('"name"')).not.toBe('"default"');
    await t.unmount();
  });

  it('shows the same file uncoloured when nothing is registered for it', async () => {
    const files = { 'mem:///config.json': '{"name": "value"}' };
    const t = await renderApp({
      width: 40, height: 6,
      onBoot: (app) => {
        app.resources.registerProvider(memoryProvider(files));
        app.open({
          surface: 'main',
          key: 'v',
          target: h('CodeViewer', { content: files['mem:///config.json'], flex: 1 }),
        });
      },
    });
    await t.settle();

    expect(t.hasText('"name"')).toBe(true);
    expect(t.errors()).toEqual([]);
    await t.unmount();
  });

  it('drops the colour on a terminal that has none', async () => {
    const files = { 'mem:///config.json': '{"name": "value"}' };
    const t = await renderApp({
      width: 40, height: 6,
      onBoot: (app) => {
        setup(files)(app);
        app.open({
          surface: 'main',
          key: 'v',
          target: h('JsonViewer', { uri: 'mem:///config.json', flex: 1 }),
        });
      },
    });
    for (let i = 0; i < 6; i++) await t.settle();
    t.setCapabilities({ colorDepth: 0 });
    await t.settle();

    const buffer = t.app.buffer();
    const x = t.line(0).indexOf('"name"');
    expect(buffer.get(x, 0)?.fg).toBe('default');
    expect(t.hasText('"name"')).toBe(true);
    await t.unmount();
  });
});

describe('document buffers', () => {
  it('opens a resource once and hands the same buffer to every reader', async () => {
    const files = { 'mem:///a.json': '{"a":1}' };
    const t = await renderApp({
      width: 40, height: 6,
      onBoot: (app) => setup(files)(app),
    });

    const first = await openDocument(t.app, 'mem:///a.json');
    const second = await openDocument(t.app, 'mem:///a.json');
    expect(second).toBe(first);
    expect(getDocument(t.app.store, 'mem:///a.json')?.content).toBe('{"a":1}');
    await t.unmount();
  });

  it('is dirty once it differs from what was read, and clean again on revert', async () => {
    const files = { 'mem:///a.json': '{"a":1}' };
    const t = await renderApp({ width: 40, height: 6, onBoot: (app) => setup(files)(app) });

    await openDocument(t.app, 'mem:///a.json');
    expect(isDocumentDirty(t.app.store, 'mem:///a.json')).toBe(false);

    setDocumentContent(t.app.store, 'mem:///a.json', '{"a":2}');
    expect(isDocumentDirty(t.app.store, 'mem:///a.json')).toBe(true);
    await t.unmount();
  });

  it('refuses to save a read-only resource', async () => {
    const files = { 'mem:///a.json': '{"a":1}' };
    const t = await renderApp({ width: 40, height: 6, onBoot: (app) => setup(files)(app) });

    await openDocument(t.app, 'mem:///a.json');
    setDocumentContent(t.app.store, 'mem:///a.json', '{"a":2}');
    await expect(saveDocument(t.app, 'mem:///a.json')).rejects.toThrow(/read-only/);
    expect(files['mem:///a.json']).toBe('{"a":1}');
    await t.unmount();
  });

  it('writes through the provider and clears the dirty flag when it can', async () => {
    const files = { 'mem:///a.json': '{"a":1}' };
    const t = await renderApp({
      width: 40, height: 6,
      onBoot: (app) => setup(files, { writable: true })(app),
    });

    await openDocument(t.app, 'mem:///a.json');
    setDocumentContent(t.app.store, 'mem:///a.json', '{"a":2}');
    await saveDocument(t.app, 'mem:///a.json');

    expect(files['mem:///a.json']).toBe('{"a":2}');
    expect(isDocumentDirty(t.app.store, 'mem:///a.json')).toBe(false);
    await t.unmount();
  });

  it('shows a buffer change in every viewer of that resource', async () => {
    const files = { 'mem:///a.json': '{"a":1}' };
    const t = await renderApp({
      width: 60, height: 8,
      onBoot: (app) => {
        setup(files)(app);
        app.open({
          surface: 'main',
          key: 'v',
          target: h('box', { direction: 'column', flex: 1 },
            h('JsonViewer', { uri: 'mem:///a.json', flex: 1 })),
        });
      },
    });
    for (let i = 0; i < 6; i++) await t.settle();
    expect(t.hasText('{"a":1}')).toBe(true);

    setDocumentContent(t.app.store, 'mem:///a.json', '{"a":999}');
    await t.settle();
    expect(t.hasText('{"a":999}')).toBe(true);
    await t.unmount();
  });
});

describe('the JSON adapter', () => {
  async function withJson(content = '{"b":2,"a":1}') {
    const files = { 'mem:///a.json': content };
    const t = await renderApp({ width: 60, height: 10, onBoot: (app) => setup(files)(app) });
    await openDocument(t.app, 'mem:///a.json');
    return { t, files };
  }

  function run(app: TextUIApp, id: string, uri: string) {
    const action = app.resources.actionsFor('file.data.json', 'context').find((a) => a.id === id);
    if (!action) throw new Error(`no action ${id}`);
    return action.run({ uri }, { app, store: app.store, scopeId: null, source: 'menu' });
  }

  it('classifies a .json file and registers two viewers for it', async () => {
    const { t } = await withJson();
    const resource = await t.app.resources.stat('mem:///a.json');

    expect(resource?.kind).toBe('file.data.json');
    expect(t.app.resources.viewersFor('file.data.json').map((v) => v.id))
      .toEqual(expect.arrayContaining(['json.source', 'json.tree']));
    await t.unmount();
  });

  it('offers its transforms as actions on that kind', async () => {
    const { t } = await withJson();
    const ids = t.app.resources.actionsFor('file.data.json', 'context').map((a) => a.id);
    expect(ids).toEqual(expect.arrayContaining(['json.format', 'json.minify', 'json.sortKeys', 'json.validate']));
    await t.unmount();
  });

  it('formats the buffer without touching the file', async () => {
    const { t, files } = await withJson('{"a":1}');
    await run(t.app, 'json.format', 'mem:///a.json');

    expect(getDocument(t.app.store, 'mem:///a.json')?.content).toBe('{\n  "a": 1\n}');
    expect(files['mem:///a.json']).toBe('{"a":1}');
    await t.unmount();
  });

  it('minifies and sorts', async () => {
    const { t } = await withJson('{\n  "b": 2,\n  "a": 1\n}');
    await run(t.app, 'json.minify', 'mem:///a.json');
    expect(getDocument(t.app.store, 'mem:///a.json')?.content).toBe('{"b":2,"a":1}');

    await run(t.app, 'json.sortKeys', 'mem:///a.json');
    expect(getDocument(t.app.store, 'mem:///a.json')?.content).toBe('{\n  "a": 1,\n  "b": 2\n}');
    await t.unmount();
  });

  it('says why rather than mangling an invalid document', async () => {
    const { t } = await withJson('{"a": }');
    await run(t.app, 'json.format', 'mem:///a.json');

    expect(getDocument(t.app.store, 'mem:///a.json')?.content).toBe('{"a": }');
    expect(t.app.layers.entries('notification')).toHaveLength(1);
    await t.settle();
    expect(t.hasText('Cannot format')).toBe(true);
    await t.unmount();
  });

  it('registers the same transforms as palette commands', async () => {
    const { t } = await withJson('{"a":1}');
    t.app.store.set('$/active/resource', { uri: 'mem:///a.json', kind: 'file.data.json' });

    await t.app.execute('json.minify');
    expect(getDocument(t.app.store, 'mem:///a.json')?.content).toBe('{"a":1}');
    await t.unmount();
  });

  it('reads the selection from wherever the application keeps it', async () => {
    const files = { 'mem:///a.json': '{\n  "a": 1\n}' };
    const t = await renderApp({
      width: 60, height: 10,
      onBoot: (app) => {
        app.resources.registerProvider(memoryProvider(files));
        app.resources.registerKind({ id: 'file', title: 'File' });
        app.resources.registerKind({ id: 'file.data', title: 'Data', extends: 'file' });
        app.registerAdapter(jsonAdapter({ activePath: '$/app/editor/open' }));
      },
    });
    await openDocument(t.app, 'mem:///a.json');

    // The default path is not this application's, so a selection there means
    // nothing: the command's `when` never opens and it stays unreachable.
    t.app.store.set('$/active/resource', { uri: 'mem:///a.json', kind: 'file.data.json' });
    await expect(t.app.execute('json.minify')).rejects.toThrow(/json\.minify/);

    t.app.store.set('$/app/editor/open', { uri: 'mem:///a.json', kind: 'file.data.json' });
    await t.app.execute('json.minify');
    expect(getDocument(t.app.store, 'mem:///a.json')?.content).toBe('{"a":1}');
    await t.unmount();
  });

  it('takes its kinds and colours away again when disposed', async () => {
    const files = { 'mem:///a.json': '{"a":1}' };
    const t = await renderApp({
      width: 40, height: 6,
      onBoot: (app) => {
        app.resources.registerProvider(memoryProvider(files));
        app.resources.registerKind({ id: 'file', title: 'File' });
        app.resources.registerKind({ id: 'file.data', title: 'Data', extends: 'file' });
      },
    });

    const registration = t.app.registerAdapter(jsonAdapter());
    expect(t.app.syntax.find({ kind: 'file.data.json' })?.id).toBe('json');

    registration.dispose();
    expect(t.app.syntax.find({ kind: 'file.data.json' })).toBeUndefined();
    expect(t.app.resources.viewersFor('file.data.json')).toEqual([]);
    expect(t.app.resources.actionsFor('file.data.json', 'context')).toEqual([]);
    await t.unmount();
  });
});

describe('the store hooks', () => {
  it('seeds the path from useStore, so every reader agrees', async () => {
    const Writer = defineComponent('Writer', () => {
      const [value] = useStore<string>('$/demo/name', 'seeded');
      return h('text', { content: `writer=${value ?? ''}` });
    });
    const Reader = defineComponent('Reader', () => {
      const value = useStoreValue<string>('$/demo/name');
      return h('text', { content: `reader=${value ?? 'nothing'}` });
    });

    const t = await render(h('box', { direction: 'column' }, h(Writer, {}), h(Reader, {})), {
      width: 40, height: 4,
    });
    await t.settle();

    expect(t.hasText('writer=seeded')).toBe(true);
    expect(t.hasText('reader=seeded')).toBe(true);
    await t.unmount();
  });

  it('does not write from useStoreValue: a fallback is this reader\'s alone', async () => {
    const Reader = defineComponent('Reader', () => {
      const value = useStoreValue<string>('$/demo/other', 'fallback');
      return h('text', { content: `reader=${value ?? ''}` });
    });

    const t = await render(h(Reader, {}), { width: 40, height: 3 });
    await t.settle();

    expect(t.hasText('reader=fallback')).toBe(true);
    expect(t.app.store.has('$/demo/other')).toBe(false);
    await t.unmount();
  });
});

describe('layers and state', () => {
  it('keeps component state when a toast appears', async () => {
    const Counter = defineComponent('Counter', () => {
      const [count, setCount] = useState(0);
      return h('box', { direction: 'column' },
        h('text', { content: `count=${count}` }),
        h('Button', { label: 'bump', autoFocus: true, onPress: () => setCount(count + 1) }));
    });

    const t = await renderApp({
      width: 40, height: 6,
      onBoot: (app) => app.open({ surface: 'main', key: 'c', target: h(Counter, {}) }),
    });
    await t.settle();

    t.press('enter');
    t.press('enter');
    await t.settle();
    expect(t.hasText('count=2')).toBe(true);

    // Opening a layer must not change the shape of the root, or every screen
    // in the application quietly remounts.
    notify(t.app, { message: 'something happened' });
    await t.settle();

    expect(t.hasText('count=2')).toBe(true);
    expect(t.hasText('something happened')).toBe(true);
    await t.unmount();
  });
});

describe('a text field with a label', () => {
  it('puts the caret where the typing lands, not where the box begins', async () => {
    const Field = defineComponent('Field', () => {
      const [value, setValue] = useState('');
      return h('TextInput', { value, onChange: setValue, label: 'name', autoFocus: true });
    });

    const t = await render(h(Field, {}), { width: 40, height: 3 });
    t.type('abc');
    await t.settle();

    const field = t.getByRole('textbox');
    const row = t.line(1);
    expect(row).toContain('name abc');

    // `cursor` is an offset into the field's content box: past the border and
    // the padding, past the label, and past what has been typed. Counting the
    // label is the part that used to be missing.
    const inset = 2; // border + padding
    const caret = (field.rect?.x ?? 0) + inset + (field.props.cursor as number);
    expect(caret).toBe(row.indexOf('abc') + 'abc'.length);
    await t.unmount();
  });

  it('scrolls a long value instead of losing the caret off the end', async () => {
    const Field = defineComponent('Field', () => {
      const [value, setValue] = useState('');
      return h('TextInput', { value, onChange: setValue, label: 'name', width: 20, autoFocus: true });
    });

    const t = await render(h(Field, {}), { width: 40, height: 3 });
    t.type('0123456789abcdefghij');
    await t.settle();

    const element = t.getByRole('textbox');
    const cursor = element.props.cursor as number;
    // Inside the field, always: two for the border and padding, and the rest
    // is the label plus the visible part of the value.
    expect(cursor).toBeGreaterThanOrEqual(0);
    expect(cursor).toBeLessThanOrEqual(20);
    expect(t.hasText('ghij')).toBe(true);
    await t.unmount();
  });
});
