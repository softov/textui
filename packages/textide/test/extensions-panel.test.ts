import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { renderApp } from '@textui/testing';
import { loadExtensions, loadWorkspace, registerTextide } from '../src/index.js';
import type { ExtensionModule } from '../src/index.js';

/**
 * The Extensions panel.
 *
 * The payoff of the manifest: this file names no extension, and neither does
 * the panel. It reads `$/ui/extensions` and draws whatever is there, which is
 * the same route every other panel takes to whatever it draws.
 *
 * Checked at two sizes, because a panel that fits at one is a panel that has
 * not met the other.
 */

let dir: string;

const SIZES = [
  { width: 96, height: 20 },
  { width: 140, height: 44 },
];

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'textide-extpanel-'));
  await writeFile(join(dir, 'a.txt'), 'a\n');
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

const DEMO: ExtensionModule = {
  manifest: {
    source: {
      id: 'test.demo',
      displayName: 'Demo',
      version: '1.4.0',
      description: 'A demo.',
    },
    contributes: {
      commands: [{ id: 'demo.one', title: 'One', slots: [], run: () => {} }],
    },
  },
};

async function open(size: { width: number; height: number }, specifiers: string[] = []) {
  const workspace = await loadWorkspace(dir);
  workspace.extensions = specifiers;
  // Off, or a repository under /tmp would load git and change the counts.
  workspace.builtinExtensions = false;

  const t = await renderApp({
    ...size, shell: 'workbench', theme: 'workbench',
    onBoot: (app) => registerTextide(app, { workspace }),
  });
  const quiet = async (): Promise<void> => {
    for (let i = 0; i < 12; i++) { await t.settle(); t.advance(50); t.flush(); }
  };
  await quiet();
  return { t, quiet, workspace };
}

for (const size of SIZES) {
  const at = `${size.width}x${size.height}`;

  describe(`the extensions panel at ${at}`, () => {
    it('is the sidebar\'s second panel, and not the one showing', async () => {
      const { t } = await open(size);
      const keys = t.app.surfaces.mounts('sidebar').map((m) => m.key);
      expect(keys).toEqual(['explorer', 'extensions']);
      // One at a time, and the explorer is first.
      expect(t.hasText('Nothing loaded.')).toBe(false);
      await t.unmount();
    });

    it('says how to fill itself when nothing is loaded', async () => {
      const { t, quiet } = await open(size);
      t.app.surfaces.activate('sidebar', 'extensions');
      await quiet();

      expect(t.hasText('Extensions'), 'the heading names the panel').toBe(true);
      expect(t.hasText('Nothing loaded.')).toBe(true);
      // An empty panel that does not say how to fill it is a dead end, and a
      // sentence about a config file is not a way to fill it.
      expect(t.hasText('Add')).toBe(true);
      await t.unmount();
    });

    it('lists one, and counts them under the list', async () => {
      const { t, quiet, workspace } = await open(size, ['demo']);
      const extensions = await loadExtensions(t.app, workspace, {
        load: () => Promise.resolve(DEMO),
      });
      t.app.surfaces.activate('sidebar', 'extensions');
      await quiet();

      expect(t.hasText('Demo')).toBe(true);
      // The line under the list is how many and how many are wrong, and
      // nothing about the selected one - that has a tab of its own.
      expect(t.hasText('1 extension')).toBe(true);
      expect(t.hasText('A demo.'), 'the description belongs to the tab').toBe(false);

      extensions.dispose();
      await t.unmount();
    });

    /**
     * A failure used to be a toast that scrolled away and then nothing at all,
     * which is what makes "why is there no git" unanswerable.
     */
    it('shows one that failed, and why', async () => {
      const { t, quiet, workspace } = await open(size, ['broken']);
      const extensions = await loadExtensions(t.app, workspace, {
        onError: () => {},
        load: () => Promise.reject(new Error('nope')),
      });
      t.app.surfaces.activate('sidebar', 'extensions');
      await quiet();

      // The row is there and the count says one is wrong. Why is in the tab.
      expect(t.hasText('Broken')).toBe(true);
      expect(t.hasText('1 problem')).toBe(true);

      extensions.dispose();
      await t.unmount();
    });

    /**
     * Enter opens it, rather than turning it off. Enter on a list row means
     * "show me this one" everywhere else in the editor, and a key that
     * disables something is a key that disables it by accident.
     */
    it('opens one as a tab, with what it brought and what can be done', async () => {
      const { t, quiet, workspace } = await open(size, ['demo']);
      const extensions = await loadExtensions(t.app, workspace, {
        load: () => Promise.resolve(DEMO),
      });
      t.app.surfaces.activate('sidebar', 'extensions');
      await quiet();

      await t.app.execute('extensions.show', { id: 'test.demo' });
      await quiet();

      // A real mount on `main`, through the resource registry - the same road
      // `git:log/<path>` takes.
      expect(t.app.surfaces.mounts('main').length).toBeGreaterThan(0);
      expect(t.hasText('A demo.'), 'the description, in the tab').toBe(true);
      expect(t.hasText('1.4.0')).toBe(true);
      // The action is on the title row rather than after the facts, so it is
      // visible at the shortest pane either of these sizes produces.
      expect(t.hasText('Disable'), 'and the action, in the view').toBe(true);

      extensions.dispose();
      await t.unmount();
    });

    it('turns one off through the command, and says it is off', async () => {
      const { t, quiet, workspace } = await open(size, ['demo']);
      const extensions = await loadExtensions(t.app, workspace, {
        load: () => Promise.resolve(DEMO),
      });
      t.app.surfaces.activate('sidebar', 'extensions');
      await quiet();

      expect(t.app.commands.get('demo.one')).toBeDefined();
      await t.app.execute('extensions.disable', { id: 'test.demo' });
      await quiet();

      expect(t.app.commands.get('demo.one'), 'its registrations go too').toBeUndefined();
      // The row stays. Something you turned off is something you want to see.
      expect(t.hasText('Demo')).toBe(true);
      // And it is no longer counted as loaded.
      expect(t.hasText('0 extensions')).toBe(true);

      extensions.dispose();
      await t.unmount();
    });
  });
}

/**
 * What it brought, by name.
 *
 * At the larger size only: the body scrolls, and in a ten-row pane the list of
 * commands is legitimately below the fold. Asserting it at both sizes would be
 * asserting that nothing ever needs scrolling.
 */
describe('the extension view, with room', () => {
  it('lists the commands it registered', async () => {
    const { t, quiet, workspace } = await open({ width: 140, height: 44 }, ['demo']);
    const extensions = await loadExtensions(t.app, workspace, {
      load: () => Promise.resolve(DEMO),
    });
    await t.app.execute('extensions.show', { id: 'test.demo' });
    await quiet();

    expect(t.hasText('Commands (1)')).toBe(true);
    expect(t.hasText('demo.one')).toBe(true);
    expect(t.hasText('test.demo'), 'and its id, in full').toBe(true);

    extensions.dispose();
    await t.unmount();
  });
});
