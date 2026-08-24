import { describe, expect, it } from 'vitest';
import { renderApp } from '@textui/testing';
import { renderToString } from '@textui/core';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { PLAYGROUNDS, findPlayground, setupPlayground } from '../src/registry.js';
import { fixtures } from '../src/data.js';

/**
 * The playgrounds are tests.
 *
 * A showcase that is only ever looked at rots: someone changes a default, the
 * gallery renders an empty box, and nobody notices for a month. Mounting every
 * playground and asserting it produced something - with no runtime errors -
 * is what keeps them honest.
 */

async function mount(id: string, options: { width?: number; height?: number; theme?: string } = {}) {
  const playground = findPlayground(id);
  if (!playground) throw new Error(`no playground "${id}"`);

  return renderApp({
    width: options.width ?? playground.minSize?.width ?? 100,
    height: options.height ?? playground.minSize?.height ?? 30,
    shell: playground.shell ?? 'plain',
    ...(options.theme ? { theme: options.theme } : {}),
    onBoot: (app) => {
      setupPlayground(app, playground);
      app.open({ surface: 'main', key: id, target: playground.node() });
    },
  });
}

describe('every playground', () => {
  for (const playground of PLAYGROUNDS) {
    describe(playground.id, () => {
      it('mounts and renders something', async () => {
        const t = await mount(playground.id);
        await t.settle();

        expect(t.text().trim().length).toBeGreaterThan(0);
        expect(t.errors()).toEqual([]);
        await t.unmount();
      });

      it('renders no missing-component markers', async () => {
        const t = await mount(playground.id);
        await t.settle();

        // The runtime prints `<Name>` for a component nobody registered.
        const missing = /<[A-Z][\w.]*>/.exec(t.text());
        expect(missing, `unregistered component: ${missing?.[0]}`).toBeNull();
        await t.unmount();
      });

      it('survives a narrow terminal', async () => {
        const t = await mount(playground.id);
        t.resize(40, 12);
        await t.settle();

        expect(t.errors()).toEqual([]);
        expect(t.lines().every((line) => line.length <= 40)).toBe(true);
        await t.unmount();
      });

      it('survives an ascii, colourless terminal', async () => {
        const t = await mount(playground.id);
        t.setCapabilities({ unicode: 'ascii', colorDepth: 0, wideChars: false });
        await t.settle();

        expect(t.errors()).toEqual([]);
        // The theme owns box drawing, block elements and braille. Literal text
        // an author wrote is their business; these ranges are the library's,
        // and none of them may survive an ascii downgrade.
        expect(/[\u2500-\u25FF\u2800-\u28FF\u2190-\u21FF]/.test(t.text())).toBe(false);
        await t.unmount();
      });

      it('renders statically, with no application at all', () => {
        const text = renderToString(playground.node(), {
          width: 100,
          height: 30,
          initialState: fixtures(),
        });
        expect(typeof text).toBe('string');
      });
    });
  }
});

describe('the gallery', () => {
  it('shows every section', async () => {
    const t = await mount('gallery');
    for (const section of ['Display', 'Controls', 'Data', 'Feedback', 'Navigation']) {
      expect(t.hasText(section)).toBe(true);
    }
    await t.unmount();
  });

  it('switches section with the tab strip', async () => {
    const t = await mount('gallery');
    expect(t.hasText('degraded')).toBe(true);

    t.focus(t.getByRole('tablist').id);
    // Display, Type, Controls - two rights to reach the third.
    t.press('right'); await t.settle();
    expect(t.hasText('breaks between words')).toBe(true);
    t.press('right'); await t.settle();
    expect(t.hasText('Type here')).toBe(true);
    await t.unmount();
  });
});

describe('the store playground', () => {
  it('propagates one write to two readers', async () => {
    const t = await mount('store');
    expect(t.hasText('billing-worker')).toBe(true);
    expect(t.hasText('BILLING-WORKER')).toBe(true);

    t.store.set('$/demo/agent/name', 'mailer');
    t.flush();
    expect(t.hasText('mailer')).toBe(true);
    expect(t.hasText('MAILER')).toBe(true);
    await t.unmount();
  });

  it('keeps a computed path in step with its collection', async () => {
    const t = await mount('store');
    t.store.collection('$/demo/alerts/list').append({ id: 1, text: 'first' });
    t.flush();

    expect(t.hasText('first')).toBe(true);
    expect(t.store.get('$/summary/demo/alerts')).toBe(1);
    await t.unmount();
  });
});

describe('the commands playground', () => {
  it('runs a command from its button and its keybinding alike', async () => {
    const t = await mount('commands');
    expect(t.store.get('$/demo/counter')).toBeUndefined();

    await t.app.execute('demo.increment');
    t.flush();
    expect(t.store.get('$/demo/counter')).toBe(1);

    t.press('+');
    expect(t.store.get('$/demo/counter')).toBe(2);
    await t.unmount();
  });

  it('disables a command whose when clause is false', async () => {
    const t = await mount('commands');
    expect(t.app.commands.enabled('demo.reset')).toBe(false);

    await t.app.execute('demo.increment');
    expect(t.app.commands.enabled('demo.reset')).toBe(true);
    await t.unmount();
  });
});

describe('the focus playground', () => {
  it('moves through the tab order', async () => {
    const t = await mount('focus');
    const first = t.focused()?.label;

    t.tab();
    expect(t.focused()?.label).not.toBe(first);
    await t.unmount();
  });

  it('registers the grid cells as focusables', async () => {
    const t = await mount('focus');
    expect(t.getAllByRole('gridcell')).toHaveLength(6);
    await t.unmount();
  });
});

describe('the overlays playground', () => {
  it('opens a dialog on the modal layer', async () => {
    const t = await mount('overlays');
    t.clickOn(t.getByRole('button', { name: 'Dialog' }));
    await t.settle();

    expect(t.hasText('Composed by hand')).toBe(true);
    expect(t.app.layers.entries('modal')).toHaveLength(1);
    await t.unmount();
  });

  it('closes it again on escape', async () => {
    const t = await mount('overlays');
    t.clickOn(t.getByRole('button', { name: 'Dialog' }));
    await t.settle();

    t.press('escape');
    await t.settle();
    expect(t.app.layers.entries('modal')).toHaveLength(0);
    await t.unmount();
  });

  it('tabs between the field and the buttons of a prompt', async () => {
    const t = await mount('overlays');
    t.clickOn(t.getByRole('button', { name: 'Prompt' }));
    await t.settle();

    const seen: (string | undefined)[] = [t.focused()?.label];
    for (let i = 0; i < 3; i++) {
      t.tab();
      await t.settle();
      seen.push(t.focused()?.label);
    }

    expect(new Set(seen).size).toBe(3);
    expect(seen).toContain('New name');
    expect(seen).toContain('OK');
    expect(seen).toContain('Cancel');
    await t.unmount();
  });

  /**
   * The screen wires its buttons to commands and nothing else, so this asserts
   * the wiring is real rather than parallel: the palette lists what the
   * buttons run, and running it from there does the same thing.
   */
  it('offers the same commands its buttons run', async () => {
    const t = await mount('overlays');
    await t.settle();

    const ids = t.app.commands.list({ slot: 'palette', enabledOnly: true }).map((c) => c.id);
    expect(ids).toEqual(expect.arrayContaining([
      'overlay.dialog', 'overlay.confirm', 'overlay.prompt', 'overlay.toast', 'overlay.theme',
    ]));

    await t.app.execute('overlay.dialog');
    await t.settle();
    expect(t.hasText('Composed by hand')).toBe(true);
    await t.unmount();
  });

  it('drills into a command that needs an argument', async () => {
    const t = await mount('overlays');
    t.clickOn(t.getByRole('button', { name: 'Palette' }));
    await t.settle();

    t.type('toast');
    await t.settle();
    expect(t.hasText('Show a toast')).toBe(true);

    t.press('enter');
    await t.settle();
    // The palette asks for the tone rather than guessing one.
    expect(t.hasText('success')).toBe(true);
    expect(t.hasText('danger')).toBe(true);
    expect(t.app.layers.entries('notification')).toHaveLength(0);

    t.press('down');
    t.press('enter');
    await t.settle();

    // The toast itself is the visible proof; it is anchored bottom-right and
    // sits over the "last result" panel that also records it.
    expect(t.app.layers.entries('notification')).toHaveLength(1);
    expect(t.hasText('A success toast')).toBe(true);
    expect(t.app.layers.entries('modal')).toHaveLength(0);
    await t.unmount();
  });

  it('lists the registered themes as sub-items and switches to one', async () => {
    const t = await mount('overlays');
    t.clickOn(t.getByRole('button', { name: 'Palette' }));
    await t.settle();

    t.type('theme');
    await t.settle();
    t.press('enter');
    await t.settle();

    expect(t.hasText('workbench')).toBe(true);

    t.type('paper');
    await t.settle();
    t.press('enter');
    await t.settle();

    expect(t.app.theme.id).toBe('paper');
    await t.unmount();
  });
});

describe('the stress playground', () => {
  it('renders a thousand rows without mounting a thousand rows', async () => {
    const t = await mount('stress');
    await t.settle();

    const stats = t.app.stats();
    // Only the visible window is mounted; the rest never becomes an instance.
    expect(stats.instances).toBeLessThan(400);
    expect(t.errors()).toEqual([]);
    await t.unmount();
  });
});

describe('the shells playground', () => {
  it('lists every shell and theme', async () => {
    const t = await mount('shells');
    for (const shell of ['Plain', 'Console', 'Paper', 'Workbench']) {
      expect(t.hasText(shell)).toBe(true);
    }
    await t.unmount();
  });
});

/**
 * Settle until something is true, rather than a fixed number of times.
 *
 * The explorer reads a real directory: how many turns of the loop that takes
 * is a property of the filesystem, not of the component, and a fixed count is
 * how a test starts failing on a slower machine.
 */
/**
 * What the explorer will show, read the same way the provider reads it.
 *
 * The tests run with different working directories depending on how they are
 * invoked, so asserting on the names in this repository's root is asserting on
 * the runner. Ask the filesystem instead.
 */
async function rootEntries(): Promise<{ name: string; dir: boolean; size: number }[]> {
  const entries = await readdir(process.cwd(), { withFileTypes: true });
  const visible = entries.filter((e) => !e.name.startsWith('.'));

  const out: { name: string; dir: boolean; size: number }[] = [];
  for (const entry of visible) {
    const dir = entry.isDirectory();
    let size = 0;
    if (!dir) {
      try {
        size = (await stat(join(process.cwd(), entry.name))).size;
      } catch {
        size = 0;
      }
    }
    out.push({ name: entry.name, dir, size });
  }
  return out.sort((a, b) => (a.dir === b.dir ? a.name.localeCompare(b.name) : a.dir ? -1 : 1));
}

/**
 * Settle until something is true, on a clock rather than on a count.
 *
 * `settle` drains the microtasks and takes one turn of the loop, so a run of
 * them costs almost no wall clock. That is the right shape for waiting on work
 * already queued, and no use at all for waiting on the filesystem: a busy
 * machine can take tens of milliseconds to answer one `stat`, and forty turns
 * of a tight loop are over in a fraction of that. Counted attempts are why
 * these tests passed alone and failed in a full run - the budget was in turns
 * of the loop, and the thing being waited for was measured in milliseconds.
 *
 * So the cheap turns come first, and then real pauses until the deadline. A
 * test that is going to pass never reaches them.
 */
async function settleUntil(
  t: Awaited<ReturnType<typeof mount>>,
  done: () => boolean,
  ms = 5000,
): Promise<void> {
  const deadline = Date.now() + ms;
  for (let turns = 0; !done() && Date.now() < deadline; turns++) {
    await t.settle();
    if (turns >= 8) await new Promise((resolve) => setTimeout(resolve, 2));
  }
}

describe('the explorer example', () => {
  it('lists the working directory through the resource registry', async () => {
    const entries = await rootEntries();
    const first = entries[0]?.name as string;

    const t = await mount('explorer');
    await settleUntil(t, () => t.hasText(first));

    expect(t.errors()).toEqual([]);
    // The top of the listing, as the provider sorts it: directories first,
    // then alphabetical. What is further down is scrolled out of the pane
    // rather than stretching it.
    expect(t.hasText(first)).toBe(true);
    await t.unmount();
  });

  it('classifies a markdown file and picks its viewer', async () => {
    const t = await mount('explorer');
    await t.settle();

    const readme = `file://${process.cwd()}/README.md`;
    const resource = await t.app.resources.stat(readme);
    expect(resource?.kind).toBe('file.markdown');
    expect(t.app.resources.nodeFor(resource!)?.component).toBe('MarkdownViewer');

    // The JSON adapter specialises `file.data`, so the same directory now
    // classifies one file as markdown and the other as JSON, and each gets the
    // viewer registered for it.
    const config = `file://${process.cwd()}/package.json`;
    const data = await t.app.resources.stat(config);
    expect(data?.kind).toBe('file.data.json');
    expect(t.app.resources.nodeFor(data!)?.component).toBe('JsonViewer');
    await t.unmount();
  });

  it('offers the actions registered for a file', async () => {
    const t = await mount('explorer');
    const ids = t.app.resources.actionsFor('file.markdown', 'context').map((a) => a.id);
    expect(ids).toContain('file.copyPath');
    await t.unmount();
  });

  it('adds the JSON transforms to a .json file and only to that', async () => {
    const t = await mount('explorer');
    const jsonActions = t.app.resources.actionsFor('file.data.json', 'context').map((a) => a.id);
    const textActions = t.app.resources.actionsFor('file.markdown', 'context').map((a) => a.id);

    expect(jsonActions).toEqual(expect.arrayContaining(['json.format', 'json.minify']));
    expect(textActions).not.toContain('json.format');
    await t.unmount();
  });

  it('offers a choice of viewers for a kind that has more than one', async () => {
    const t = await mount('explorer');
    const ids = t.app.resources.viewersFor('file.data.json').map((v) => v.id);

    // Source and structure, plus whatever generic viewers also claim it.
    expect(ids.slice(0, 2)).toEqual(['json.source', 'json.tree']);
    await t.unmount();
  });

  /**
   * The regression this screen exists to prevent.
   *
   * Opening a different file used to move every pane on the screen, because
   * the viewer sized itself from the document. The frame must be identical
   * whichever file is selected - only what is inside the viewer changes.
   */
  it('draws the same frame whichever file is open', async () => {
    const entries = await rootEntries();
    const files = entries.filter((e) => !e.dir).sort((a, b) => a.size - b.size);
    const smallest = files[0]?.name as string;
    const largest = files[files.length - 1]?.name as string;

    // A second pair sharing an extension, and so a kind, and so a viewer.
    //
    // The pane a document could move is the viewer's, but the viewer for a
    // markdown file and the viewer for a json file are two different
    // components - one of them need not even mark itself as a document. Put
    // the two of them side by side and the difference measured is which viewer
    // mounted, not whether the document moved anything. Same kind, different
    // size, and the only thing left varying is how much there is to show.
    const byKind = new Map<string, typeof files>();
    for (const file of files) {
      const ext = file.name.slice(file.name.lastIndexOf('.'));
      byKind.set(ext, [...(byKind.get(ext) ?? []), file]);
    }
    const kin = [...byKind.values()].find((group) => group.length > 1);
    expect(kin, 'two files of one kind to compare').toBeDefined();
    const kinSmall = kin?.[0]?.name as string;
    const kinLarge = kin?.[kin.length - 1]?.name as string;

    const t = await mount('explorer', { width: 100, height: 26 });
    await settleUntil(t, () => t.hasText(entries[0]?.name as string));

    // Landmarks of the frame, not of the content: where the panes are and
    // where the chrome sits. What is *inside* the viewer is expected to
    // differ - that is the only thing that should.
    const shape = () => ({
      tree: t.getByRole('tree').rect,
      // The outermost one: a markdown file with a fenced code block mounts a
      // second viewer inside the first.
      viewer: t.getAllByRole('document')[0]?.rect,
      hints: t.lines().findIndex((line) => line.includes('quit')),
      detail: t.lines().findIndex((line) => line.includes('Opens with')),
      resource: t.lines().findIndex((line) => line.includes('Resource')),
    });

    /**
     * Until the frame stops moving.
     *
     * Waiting for "a document exists" is not waiting at all once one does: the
     * viewer for the previous file is still on screen while this one's content
     * is read, so the predicate is already true and the frame gets measured
     * mid-swap. The frame is what this test is about, so the frame is what it
     * waits on - three readings the same, and a floor under how long that may
     * take. The floor is the part that matters: reading the frame costs
     * nothing, so on a busy machine three identical readings can all be taken
     * before the document has even been asked for, and a pane that has not
     * started moving yet reads exactly like one that has finished.
     */
    const stable = async () => {
      const start = Date.now();
      let last = '';
      let same = 0;
      while (Date.now() - start < 2000 && (same < 3 || Date.now() - start < 30)) {
        await t.settle();
        await new Promise((resolve) => setTimeout(resolve, 2));
        const now = JSON.stringify(shape());
        same = now === last ? same + 1 : 0;
        last = now;
      }
    };

    const active = () => t.store.get<{ name?: string }>('$/active/resource')?.name;

    /**
     * From the top every time - and every step waits for its answer.
     *
     * The walk only goes downwards and the two files are not in a known order,
     * so each one is found from row zero. What makes that need care is that
     * the tree's own cursor follows the selection rather than leading it: a
     * key hands the uri to `resources.stat` and the row moves when that
     * resolves. Press the next key before it does and the tree is still
     * counting from where it was, so `home` followed by `down` on the same
     * tick does not go to the second row - it goes one below wherever the
     * previous file left the cursor, and a target above that point can never
     * be reached.
     *
     * That is what made this test fail under load and pass on a quiet machine:
     * one settle was enough for the answer most of the time.
     */
    const top = entries[0]?.name as string;
    const select = async (name: string) => {
      t.focus(t.getByRole('tree').id);
      t.press('home');
      await settleUntil(t, () => active() === top);
      expect(active(), 'the walk starts at the top row').toBe(top);

      for (let i = 0; i < entries.length + 5 && active() !== name; i++) {
        const was = active();
        t.press('down');
        await settleUntil(t, () => active() !== was);
      }
      expect(active()).toBe(name);
      await stable();
    };

    const shapeOf = async (name: string) => {
      await select(name);
      return shape();
    };

    // A short document and a long one of the same kind: the viewer's own box
    // must not have grown, which is the regression itself.
    expect(await shapeOf(kinLarge)).toEqual(await shapeOf(kinSmall));

    // And across kinds, where the viewer is a different component and only the
    // frame around it is comparable. The frame is what used to move.
    const frame = ({ viewer: _viewer, ...rest }: ReturnType<typeof shape>) => rest;
    expect(frame(await shapeOf(largest))).toEqual(frame(await shapeOf(smallest)));

    await t.unmount();
  });

  it('shows a JSON file coloured, and the same file as a structure', async () => {
    const own = JSON.parse(await readFile(join(process.cwd(), 'package.json'), 'utf8')) as { name: string };

    const t = await mount('explorer', { width: 100, height: 26 });
    await settleUntil(t, () => t.hasText('package.json'));

    t.focus(t.getByRole('tree').id);
    t.press('home');
    await t.settle();
    for (let i = 0; i < 60; i++) {
      if (t.store.get<{ name?: string }>('$/active/resource')?.name === 'package.json') break;
      t.press('down');
      await t.settle();
    }
    await settleUntil(t, () => t.hasText(own.name));

    expect(t.hasText('"name"')).toBe(true);
    expect(t.hasText(own.name)).toBe(true);

    // The tree viewer is a different component over the same document.
    expect(t.app.resources.viewersFor('file.data.json').map((v) => v.id)).toContain('json.tree');
    await t.unmount();
  });

  it('lets you pick which viewer opens the file', async () => {
    const t = await mount('explorer', { width: 100, height: 26 });
    await settleUntil(t, () => t.hasText('package.json'));

    t.focus(t.getByRole('tree').id);
    t.press('home');
    await t.settle();
    for (let i = 0; i < 60; i++) {
      if (t.store.get<{ name?: string }>('$/active/resource')?.name === 'package.json') break;
      t.press('down');
      await t.settle();
    }
    await settleUntil(t, () => t.queryByRole('document') !== null);

    // Source first, because it is the higher-priority viewer for the kind.
    expect(t.getAllByComponent('JsonViewer')).toHaveLength(1);
    expect(t.getAllByComponent('JsonTreeViewer')).toHaveLength(0);

    // Choose the other one from the pane that lists them.
    const menu = t.getAllByRole('menu')[0];
    expect(menu).toBeDefined();
    t.focus((menu as { id: string }).id);
    t.press('down');
    t.press('enter');
    await settleUntil(t, () => t.getAllByComponent('JsonTreeViewer').length > 0);

    expect(t.getAllByComponent('JsonTreeViewer')).toHaveLength(1);
    expect(t.getAllByComponent('JsonViewer')).toHaveLength(0);
    // The structure view shows the keys of the same document.
    expect(t.hasText('scripts')).toBe(true);
    await t.unmount();
  });

  it('transforms the buffer without writing to a read-only file', async () => {
    const t = await mount('explorer', { width: 100, height: 26 });
    await settleUntil(t, () => t.hasText('package.json'));

    const uri = `file://${process.cwd()}/package.json`;
    const action = t.app.resources
      .actionsFor('file.data.json', 'context')
      .find((a) => a.id === 'json.minify');

    await action?.run({ uri }, { app: t.app, store: t.store, scopeId: null, source: 'menu' });
    for (let i = 0; i < 6; i++) await t.settle();

    const doc = t.store.get<{ content: string }>(
      `$/session/documents/${uri.replace(/~/g, '~0').replace(/\//g, '~1')}`,
    );
    expect(doc?.content.startsWith('{"')).toBe(true);
    expect(doc?.content).not.toContain('\n');

    // The file on disk is untouched: the provider is read-only and nothing
    // asked it to write.
    const onDisk = await readFile(new URL(uri), 'utf8');
    expect(onDisk.startsWith('{\n')).toBe(true);
    await t.unmount();
  });
});

describe('themes', () => {
  for (const theme of ['dark', 'light', 'console', 'paper', 'workbench', 'mono']) {
    it(`renders the gallery under the ${theme} theme`, async () => {
      const t = await mount('gallery', { theme });
      expect(t.errors()).toEqual([]);
      expect(t.text().trim().length).toBeGreaterThan(0);
      await t.unmount();
    });
  }
});

describe('the registry itself', () => {
  it('gives every playground a unique id', () => {
    const ids = PLAYGROUNDS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('describes what each one exercises', () => {
    for (const playground of PLAYGROUNDS) {
      expect(playground.exercises.length).toBeGreaterThan(0);
      expect(playground.description.length).toBeGreaterThan(0);
    }
  });

  it('covers everything the brief asks a playground to exercise', () => {
    const covered = new Set(PLAYGROUNDS.flatMap((p) => p.exercises));
    for (const subject of [
      'components', 'themes', 'forms', 'store reactivity', 'tables/lists',
      'charts', 'overlays', 'commands', 'focus', 'resizing',
      'terminal capabilities', 'adapters', 'animations', 'performance',
      'resources', 'registries',
    ]) {
      expect(covered, `nothing exercises "${subject}"`).toContain(subject);
    }
  });
});

/**
 * The gallery, driven the way somebody drives it.
 *
 * Left and right walk the tab strip; down belongs to whatever is focused. A
 * list under an unfocused tab strip that moved on every arrow was the symptom
 * of dispatch offering keys to focusables that had none.
 */
describe('the gallery', () => {
  it('starts with the tab strip focused, so the keyboard has somewhere to be', async () => {
    const t = await mount('gallery');
    await t.settle();
    expect(t.app.focus.focused()).not.toBeNull();
    await t.unmount();
  });

  it('leaves the Data list alone until it is focused', async () => {
    const t = await mount('gallery');
    await t.settle();
    // Display, Type, Controls, Data.
    t.press('right'); await t.settle();
    t.press('right'); await t.settle();
    t.press('right'); await t.settle();
    expect(t.hasText('billing-worker')).toBe(true);

    const before = t.lines().find((l) => l.includes('mailer'));
    t.press('down'); await t.settle();
    t.press('down'); await t.settle();
    expect(t.lines().find((l) => l.includes('mailer'))).toBe(before);

    // Tab reaches it, and then the arrows are its own.
    t.press('tab'); await t.settle();
    t.press('down'); await t.settle();
    expect(t.lines().find((l) => l.includes('mailer'))).not.toBe(before);
    await t.unmount();
  });
});

/**
 * The card and the fact list hold more than they show.
 *
 * That is the point of them: a paragraph that fits proves nothing about the
 * wrapper, and a list that fits proves nothing about the viewport. Both are
 * filled past the fold so that resizing this page is a test of rewrapping and
 * tabbing into it is a test of scrolling.
 */
describe('the gallery display section', () => {
  it('wraps the card body and keeps the last paragraph below the fold', async () => {
    const t = await mount('gallery', { width: 92, height: 30 });
    await t.settle();

    expect(t.hasText('A card is a titled box')).toBe(true);
    // The closing words, out of view until something scrolls. Not a phrase
    // from the middle of a sentence: the wrapper breaks those across two
    // lines and `hasText` would never find them however far it scrolled,
    // which is a test that passes without ever looking.
    expect(t.hasText('rows wrong.')).toBe(false);
    await t.unmount();
  });

  it('rewraps when the width changes', async () => {
    const t = await mount('gallery', { width: 92, height: 30 });
    await t.settle();
    const wide = t.lines().find((l) => l.includes('A card is a titled box'));

    await t.resize(70, 30);
    await t.settle();
    const narrow = t.lines().find((l) => l.includes('A card is a titled box'));

    expect(narrow).not.toBe(wide);
    await t.unmount();
  });

  it('lets the keyboard reach what did not fit', async () => {
    const t = await mount('gallery', { width: 92, height: 30 });
    await t.settle();
    expect(t.hasText('rows wrong.')).toBe(false);

    // Tab leaves the strip for the card's viewport, and then down is its own.
    t.press('tab');
    await t.settle();
    for (let i = 0; i < 40; i++) { t.press('down'); await t.settle(); }

    // Forty presses for a dozen rows of overflow: the viewport stops at its
    // last line rather than walking the text off the top, so pressing past
    // the end is not the same as pressing past the content.
    expect(t.hasText('rows wrong.')).toBe(true);
    expect(t.hasText('A card is a titled box')).toBe(false);
    await t.unmount();
  });

  it('cuts the fact list off rather than growing past the frame', async () => {
    const t = await mount('gallery', { width: 92, height: 30 });
    await t.settle();

    expect(t.hasText('billing:2.14.0')).toBe(true);
    // Fourteen facts do not fit in the rows this pane was given.
    expect(t.hasText('stable')).toBe(false);
    await t.unmount();
  });
});
