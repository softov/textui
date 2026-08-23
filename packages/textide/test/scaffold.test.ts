import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { renderApp } from '@textui/testing';
import { loadWorkspace, loadExtensions, registerTextide } from '../src/index.js';
import { extensionSource, scaffoldExtension, slugOf } from '../src/scaffold.js';

/**
 * The extension somebody has not written yet.
 *
 * The loader worked and there was nothing loadable, so "Add Extension" was a
 * question with no answer. A scaffold answers it - but a scaffold that writes
 * something which does not load is worse than none at all, because the first
 * thing you learn from it is that the system is broken.
 *
 * So the test that matters is not "a file appeared". It is that what appeared
 * loads, contributes what it said it would, and draws.
 */

const dirs: string[] = [];

afterEach(async () => {
  for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true });
});

async function workspaceDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'textide-scaffold-'));
  dirs.push(dir);
  await writeFile(join(dir, 'a.md'), 'one two three\nfour five\n');
  return dir;
}

describe('slugOf', () => {
  it.each([
    ['Word Count', 'word-count'],
    ['  Spaced  Out  ', 'spaced-out'],
    ['My_Tool v2', 'my-tool-v2'],
    // Accented letters go the way punctuation does. Not ideal as a *name*,
    // but a slug is a filename and an import specifier before it is a label,
    // and the display name keeps whatever was typed.
    ['Ünïcodé', 'n-cod'],
  ] as [string, string][])('%j becomes %j', (name, slug) => {
    expect(slugOf(name)).toBe(slug);
  });

  it('never returns an empty name, because a file needs one', () => {
    // A specifier goes into a config file, through `import()` and onto a
    // filesystem, and `./tools/.js` is not a path any of the three want.
    expect(slugOf('!!!')).toBe('extension');
    expect(slugOf('')).toBe('extension');
  });
});

describe('what the scaffold writes', () => {
  it('has no imports in it at all', () => {
    const source = extensionSource('Word Count');
    // The claim the file makes about itself, checked. An extension that needed
    // `@textui/core` resolvable from the workspace would not load in a project
    // that has never heard of textui.
    expect(source).not.toMatch(/^\s*import\s/m);
    expect(source).not.toMatch(/\brequire\(/);
  });

  it('refuses to overwrite one that is already there', async () => {
    const dir = await workspaceDir();
    await scaffoldExtension(dir, 'Word Count');
    // "New" sits one row from "Add" in a menu, and a scaffold that clobbers
    // eats the extension you were halfway through writing.
    await expect(scaffoldExtension(dir, 'Word Count')).rejects.toThrow(/already exists/);
  });

  it('names the file, the panel and the source from the one name', async () => {
    const dir = await workspaceDir();
    const { path, specifier } = await scaffoldExtension(dir, 'Word Count');
    expect(specifier).toBe('./tools/word-count.js');
    const source = await readFile(path, 'utf8');
    expect(source).toContain("id: 'local.word-count'");
    expect(source).toContain("component: 'WordCountPanel'");
    expect(source).toContain("id: 'word-count.show'");
  });
});

const SIZES = [
  { width: 96, height: 22 },
  { width: 130, height: 34 },
] as const;

describe.each(SIZES)('and it loads, at $width x $height', (size) => {
  async function boot(dir: string) {
    const workspace = await loadWorkspace(dir);
    const t = await renderApp({
      width: size.width,
      height: size.height,
      shell: 'workbench',
      theme: 'workbench',
      onBoot: (app) => registerTextide(app, { workspace }),
    });
    const quiet = async (): Promise<void> => {
      for (let i = 0; i < 12; i++) { await t.settle(); t.advance(50); t.flush(); }
    };
    await quiet();
    const bag = await loadExtensions(t.app, workspace, {});
    await quiet();
    return { t, quiet, bag, workspace };
  }

  it('writes, loads and shows a panel, from one command', async () => {
    const dir = await workspaceDir();
    const { t, quiet, bag } = await boot(dir);

    await t.app.execute('extensions.new', { name: 'Word Count' });
    await quiet();

    expect(t.errors(), 'nothing went wrong writing or loading it').toEqual([]);
    // The manifest's three contributions, all present.
    expect(t.app.manifest.loaded('local.word-count'), 'the manifest loaded').toBe(true);
    expect(t.app.commands.get('word-count.show')?.title).toBe('Show Word Count');
    expect(t.app.surfaces.mounts('sidebar').map((m) => m.key)).toContain('word-count');

    // And the source is in front of you, which is the point of scaffolding
    // rather than describing.
    expect(t.app.store.get('$/ui/editor/uri')).toMatch(/tools\/word-count\.js$/);
    bag.dispose();
    await t.unmount();
  });

  it('counts the file that is open, and follows it', async () => {
    const dir = await workspaceDir();
    const { t, quiet, bag } = await boot(dir);
    await t.app.execute('extensions.new', { name: 'Word Count' });
    await quiet();

    // Its own source is what got opened, so point it at the fixture instead.
    await t.app.execute('word-count.show');
    t.app.store.set('$/ui/editor/uri', `file://${join(dir, 'a.md')}`);
    await quiet();

    // `activate` publishes and the panel binds - no hook anywhere in it.
    expect(t.hasText('a.md')).toBe(true);
    // Two, not three. The fixture ends in a newline, which terminates the
    // last line rather than starting an empty one - the off-by-one every
    // line counter is born with, and not one to teach in an example.
    expect(t.hasText('2 lines')).toBe(true);
    expect(t.hasText('5 words')).toBe(true);

    bag.dispose();
    await t.unmount();
  });

  it('is remembered, so it is still there next time', async () => {
    const dir = await workspaceDir();
    const { t, quiet, bag } = await boot(dir);
    await t.app.execute('extensions.new', { name: 'Word Count' });
    await quiet();

    // The store half is immediate; the file half is debounced, and a real
    // timer rather than the harness clock.
    expect(t.app.store.get('$/app/extensions')).toEqual(['./tools/word-count.js']);
    await new Promise((r) => { setTimeout(r, 500); });
    const config = JSON.parse(await readFile(join(dir, '.textide.json'), 'utf8')) as
      { extensions?: string[] };
    expect(config.extensions).toEqual(['./tools/word-count.js']);

    bag.dispose();
    await t.unmount();
  });

  it('says so, and still opens the file, when the name is taken', async () => {
    const dir = await workspaceDir();
    await mkdir(join(dir, 'tools'), { recursive: true });
    await writeFile(join(dir, 'tools', 'word-count.js'), '// mine\n');
    const { t, quiet, bag } = await boot(dir);

    await t.app.execute('extensions.new', { name: 'Word Count' });
    await quiet();

    expect(await readFile(join(dir, 'tools', 'word-count.js'), 'utf8'))
      .toBe('// mine\n');
    expect(t.errors(), 'a name that is taken is a message, not a fault').toEqual([]);
    bag.dispose();
    await t.unmount();
  });
});
