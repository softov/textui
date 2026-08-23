import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { render, renderApp } from '@textui/testing';
import { loadWorkspace, registerTextide } from '../src/index.js';
import { Tree, h } from '@textui/core';
import { FULL_ICONS } from '../src/icons.js';

/**
 * What a row in the explorer looks like.
 *
 * The thing that knows what a markdown file is is the thing that opens
 * markdown files, so the icon and the colour are declared where the kind is
 * and read back off the registry - which is what lets a viewer an extension
 * brought name its own rows without the explorer learning what it opened.
 */

let dir: string;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'textide-icons-'));
  await mkdir(join(dir, 'src'));
  await writeFile(join(dir, 'README.md'), '# a\n');
  await writeFile(join(dir, 'main.ts'), 'export const a = 1;\n');
  await writeFile(join(dir, 'data.yaml'), 'a: 1\n');
  await writeFile(join(dir, 'LICENSE'), 'MIT\n');
  await mkdir(join(dir, 'docs'));
  await writeFile(join(dir, 'src', 'inner.ts'), 'const a = 1;\n');
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

const SIZES = [
  { width: 96, height: 20 },
  { width: 130, height: 34 },
] as const;

async function open(size: { width: number; height: number }) {
  const workspace = await loadWorkspace(dir);
  const t = await renderApp({
    width: size.width,
    height: size.height,
    shell: 'workbench',
    theme: 'workbench',
    onBoot: (app) => registerTextide(app, { workspace }),
  });
  for (let i = 0; i < 12; i++) { await t.settle(); t.advance(50); t.flush(); }
  return t;
}

/** The sidebar's columns of the row naming `file`. */
function rowFor(lines: string[], file: string): string {
  return (lines.find((line) => line.includes(file)) ?? '').slice(0, 30);
}

describe.each(SIZES)('the explorer at $width x $height', (size) => {
  it.each([
    ['README.md', FULL_ICONS.markdown],
    ['main.ts', FULL_ICONS.code],
    ['data.yaml', FULL_ICONS.data],
  ])('draws %s with the icon its kind declared', async (file, icon) => {
    const t = await open(size);
    expect(rowFor(t.lines(), file)).toContain(icon);
    await t.unmount();
  });

  it('falls back to the plain file icon for a kind nobody described', async () => {
    const t = await open(size);
    // No extension, so no kind claims it beyond `file` itself.
    expect(rowFor(t.lines(), 'LICENSE')).toContain(FULL_ICONS.file);
    await t.unmount();
  });

  it('inherits through `extends` rather than falling all the way back', async () => {
    const t = await open(size);
    // `file.text` declares no icon of its own, so a `.txt` gets `file`'s -
    // which is the same glyph, and the point is that it arrives by
    // inheritance rather than by the explorer giving up.
    const look = t.app.resources.appearanceOf({ kind: 'file.text' });
    expect(look.icon).toBe(FULL_ICONS.file);
    expect(look.tone, 'and no tone, because `file` declares none').toBeUndefined();
    await t.unmount();
  });

  it('gives a folder its glyph and no second one', async () => {
    const t = await open(size);
    const row = rowFor(t.lines(), 'src');
    expect(row).toContain(FULL_ICONS.folder);
    // The tree draws the twisty for anything expandable; a kind icon beside
    // it would be a folder wearing two.
    expect(row).not.toContain(FULL_ICONS.file);
    await t.unmount();
  });
});

describe('what the registry answers', () => {
  it('prefers a renderer that speaks for the kind', async () => {
    const t = await open(SIZES[0]);
    const bag = t.app.resources.registerViewer({
      id: 'test.loud',
      title: 'Loud',
      kinds: ['file.markdown'],
      component: 'CodeViewer',
      icon: '!',
      tone: 'danger',
      // Above textide's own, so this is the one that opens it.
      priority: 500,
    });
    // The thing that opens markdown gets to say what markdown looks like.
    expect(t.app.resources.appearanceOf({ kind: 'file.markdown' }))
      .toEqual({ icon: '!', tone: 'danger' });

    bag.dispose();
    expect(t.app.resources.appearanceOf({ kind: 'file.markdown' }).icon)
      .toBe(FULL_ICONS.markdown);
    await t.unmount();
  });

  it('answers nothing for a kind nobody has registered', async () => {
    const t = await open(SIZES[0]);
    // Empty rather than a default: what an unknown thing looks like is the
    // caller's vocabulary, since which glyphs a terminal can draw is known
    // where the terminal is.
    expect(t.app.resources.appearanceOf({ kind: 'nothing.at.all' })).toEqual({});
    await t.unmount();
  });
});

/**
 * Where a row starts.
 *
 * Everything at one depth begins in one column, whatever kind of thing it is.
 * A file that starts one column right of the folder above it reads as being
 * *inside* that folder, which is a lie the eye believes before it reads a
 * single name - and it is what happened the moment files grew icons: the
 * explorer puts the folder glyph in the twisty's place, so a file's icon
 * landed in the column after it.
 */
describe.each(SIZES)('alignment at $width x $height', (size) => {
  /** The column a row's first non-space character is in, inside the sidebar. */
  function startOf(lines: string[], name: string): number {
    const line = (lines.find((l) => l.includes(name)) ?? '').slice(0, 30);
    // Past the frame's own border column.
    return line.slice(1).search(/\S/);
  }

  it('starts every sibling in the same column, folder or file', async () => {
    const t = await open(size);
    const lines = t.lines();

    const folder = startOf(lines, 'src');
    expect(startOf(lines, 'docs'), 'two folders').toBe(folder);
    for (const file of ['README.md', 'main.ts', 'data.yaml', 'LICENSE']) {
      expect(startOf(lines, file), `${file} against a folder`).toBe(folder);
    }
    await t.unmount();
  });

  it('still indents what is actually inside a folder', async () => {
    const t = await open(size);
    t.focus(t.getByRole('tree').id);
    // onto `src`, then open it
    t.press('down');
    t.press('right');
    for (let i = 0; i < 8; i++) { await t.settle(); t.advance(50); t.flush(); }

    const lines = t.lines();
    expect(t.hasText('inner.ts'), 'the child is showing').toBe(true);
    expect(startOf(lines, 'inner.ts'), 'one level in')
      .toBeGreaterThan(startOf(lines, 'src'));
    await t.unmount();
  });
});

describe('a tree where something expandable also has an icon', () => {
  it('reserves the second column on every row, including the blank ones', async () => {
    // A chevron *and* a mark is a legitimate tree, and then two columns are
    // needed - but they have to be there on every row, or the rows without an
    // icon slide back left and the misalignment returns wearing a hat.
    const t = await render(
      h(Tree, {
        nodes: [
          { id: 'a', label: 'branch', icon: '*', hasChildren: true, children: [] },
          { id: 'b', label: 'leaf' },
        ],
        autoFocus: true,
      }),
      { width: 30, height: 6 },
    );
    for (let i = 0; i < 4; i++) { await t.settle(); t.flush(); }

    const at = (name: string): number =>
      (t.lines().find((l) => l.includes(name)) ?? '').indexOf(name);
    expect(at('leaf')).toBe(at('branch'));
    await t.unmount();
  });
});
