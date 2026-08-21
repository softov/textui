import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { renderApp } from '@textui/testing';
import { loadWorkspace, registerTextide, CONFIG_FILE } from '../src/index.js';
import type { Workspace } from '../src/index.js';

/**
 * textide, against a real directory.
 *
 * A fixture directory rather than the repository: this application deletes and
 * overwrites, and a test that runs against the checkout is one stray keystroke
 * away from editing the thing it is testing.
 */

let dir: string;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'textide-'));
  await writeFile(join(dir, 'README.md'), '# Fixture\n\nSome text.\n');
  await writeFile(join(dir, 'notes.txt'), 'plain notes\n');
  await writeFile(join(dir, '.hidden'), 'not listed\n');
  await mkdir(join(dir, 'src'));
  await writeFile(join(dir, 'src', 'index.ts'), 'export const x = 1;\n');
  await mkdir(join(dir, 'node_modules'));
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function open(workspace: Workspace, size: Size = SIZES[0]!) {
  return renderApp({
    width: size.width,
    height: size.height,
    shell: 'workbench',
    theme: 'workbench',
    onBoot: (app) => registerTextide(app, { workspace }),
  });
}

interface Size { width: number; height: number }

/**
 * Every screen assertion runs at more than one size.
 *
 * A terminal is whatever size someone dragged it to, and a layout that is only
 * ever checked at one is a layout that breaks on the second. These two bracket
 * the range the workbench shell is willing to show a sidebar in.
 */
const SIZES: Size[] = [
  { width: 96, height: 20 },
  { width: 140, height: 44 },
];

const label = (s: Size): string => `${s.width}x${s.height}`;

describe('the workspace', () => {
  it('falls back to the directory name when nothing configures it', async () => {
    const workspace = await loadWorkspace(dir);
    expect(workspace.configured).toBe(false);
    expect(workspace.name).toBe(dir.split('/').pop());
    expect(workspace.theme).toBe('paper-dark');
  });

  it('reads the config file when there is one', async () => {
    await writeFile(join(dir, CONFIG_FILE), JSON.stringify({ name: 'Fixture', tabWidth: 4 }));
    const workspace = await loadWorkspace(dir);
    expect(workspace.configured).toBe(true);
    expect(workspace.name).toBe('Fixture');
    expect(workspace.tabWidth).toBe(4);
    await rm(join(dir, CONFIG_FILE));
  });

  it('survives a config file that is not JSON', async () => {
    await writeFile(join(dir, CONFIG_FILE), 'not json at all');
    const workspace = await loadWorkspace(dir);
    expect(workspace.configured).toBe(false);
    expect(workspace.tabWidth).toBe(2);
    await rm(join(dir, CONFIG_FILE));
  });
});

describe.each(SIZES.map((s) => [label(s), s] as const))('the screen at %s', (_name, size) => {
  it('lists the workspace, hiding dotfiles and the excluded', async () => {
    const t = await open(await loadWorkspace(dir), size);
    for (let i = 0; i < 8; i++) await t.settle();

    expect(t.hasText('README.md')).toBe(true);
    expect(t.hasText('notes.txt')).toBe(true);
    expect(t.hasText('src')).toBe(true);
    expect(t.hasText('.hidden')).toBe(false);
    expect(t.hasText('node_modules')).toBe(false);
    await t.unmount();
  });

  it('lists dotfiles when the workspace asks for them', async () => {
    const workspace = await loadWorkspace(dir);
    workspace.hidden = true;
    const t = await open(workspace, size);
    for (let i = 0; i < 8; i++) await t.settle();

    expect(t.hasText('.hidden')).toBe(true);
    await t.unmount();
  });

  it('names the workspace in the titlebar', async () => {
    const workspace = await loadWorkspace(dir);
    workspace.name = 'Fixture';
    const t = await open(workspace, size);
    await t.settle();

    expect(t.lines().slice(0, 4).join(' ')).toContain('Fixture');
    expect(t.hasText('no file')).toBe(true);
    await t.unmount();
  });

  it('says so when the workspace is read-only', async () => {
    const workspace = await loadWorkspace(dir);
    workspace.readonly = true;
    const t = await open(workspace, size);
    await t.settle();

    expect(t.hasText('read-only')).toBe(true);
    await t.unmount();
  });

  it('shows the root and a hint in the status bar', async () => {
    const t = await open(await loadWorkspace(dir), size);
    await t.settle();

    expect(t.hasText(dir)).toBe(true);
    expect(t.hasText('? for keys')).toBe(true);
    await t.unmount();
  });

  it('collapses and restores the sidebar', async () => {
    const t = await open(await loadWorkspace(dir), size);
    for (let i = 0; i < 8; i++) await t.settle();
    expect(t.hasText('README.md')).toBe(true);

    await t.app.execute('view.toggleSidebar');
    await t.settle();
    expect(t.hasText('README.md')).toBe(false);

    // Restoring remounts the explorer, which lists again: the tree is async,
    // so one frame is not enough to see it come back.
    await t.app.execute('view.toggleSidebar');
    for (let i = 0; i < 8; i++) await t.settle();
    expect(t.hasText('README.md')).toBe(true);
    await t.unmount();
  });

  it('draws one sidebar and no dead column beside it', async () => {
    const t = await open(await loadWorkspace(dir), size);
    for (let i = 0; i < 8; i++) await t.settle();

    // The tree starts immediately inside the frame. A second, empty region
    // reserved by the shell would push it right and leave a gutter.
    const row = t.lines().find((l) => l.includes('README.md'));
    expect(row?.indexOf('README.md')).toBeLessThan(6);

    await t.unmount();
  });
});

describe('a terminal too small for the shell', () => {
  it('drops the sidebar rather than squeezing it', async () => {
    const t = await open(await loadWorkspace(dir), { width: 70, height: 20 });
    for (let i = 0; i < 8; i++) await t.settle();

    expect(t.hasText('README.md')).toBe(false);
    expect(t.hasText('? for keys')).toBe(true);
    await t.unmount();
  });
});

describe('the filesystem adapter', () => {
  it('classifies by extension through the registry', async () => {
    const t = await open(await loadWorkspace(dir));
    const md = await t.app.resources.stat(`file://${dir}/README.md`);
    const ts = await t.app.resources.stat(`file://${dir}/src/index.ts`);
    const folder = await t.app.resources.stat(`file://${dir}/src`);

    expect(md?.kind).toBe('file.markdown');
    expect(ts?.kind).toBe('file.code');
    expect(folder?.kind).toBe('directory');
    await t.unmount();
  });

  it('offers folder actions on a directory and not on a file', async () => {
    const t = await open(await loadWorkspace(dir));
    const onFolder = t.app.resources.actionsFor('directory', 'context').map((a) => a.id);
    const onFile = t.app.resources.actionsFor('file.markdown', 'context').map((a) => a.id);

    expect(onFolder).toContain('fs.newFolder');
    expect(onFile).not.toContain('fs.newFolder');
    expect(onFile).toContain('fs.delete');
    await t.unmount();
  });

  it('registers nothing that writes when the workspace is read-only', async () => {
    const workspace = await loadWorkspace(dir);
    workspace.readonly = true;
    const t = await open(workspace);

    expect(t.app.commands.list().map((c) => c.id)).not.toContain('fs.delete');
    expect(t.app.resources.actionsFor('directory')).toHaveLength(0);
    await t.unmount();
  });
});
