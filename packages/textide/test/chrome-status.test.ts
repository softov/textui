import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { renderApp } from '@textui/testing';
import { loadWorkspace, registerTextide } from '../src/index.js';

/**
 * Who owns which row.
 *
 * The status bar used to carry four scopes at once: the workspace, the file
 * the *explorer* had highlighted, whatever the focused panel wanted to say,
 * and a key hint. Reading it meant first working out which of them each part
 * was about - and the row under the pane, meanwhile, listed keys that were
 * already written in two other places.
 *
 * Each fact now sits with the thing it is about. These tests are about where,
 * not about what: the same sentence in the wrong row is the bug.
 */

let dir: string;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'textide-status-'));
  await mkdir(join(dir, 'src'));
  await writeFile(join(dir, 'README.md'), '# Fixture\n\nSome prose.\n');
  await writeFile(join(dir, 'src', 'a.ts'), 'export const a = 1;\n');
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

const SIZES = [
  { width: 96, height: 22 },
  { width: 130, height: 32 },
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
  const quiet = async (): Promise<void> => {
    for (let i = 0; i < 12; i++) { await t.settle(); t.advance(50); t.flush(); }
  };
  await quiet();
  return { t, quiet };
}

/** The last row inside the frame - the window's own bar. */
function statusRow(lines: string[]): string {
  return lines[lines.length - 2] ?? '';
}

describe.each(SIZES)('the window bar at $width x $height', (size) => {
  it('carries the folder and the time, and nothing narrower', async () => {
    const { t } = await open(size);
    const bar = statusRow(t.lines());

    expect(bar, 'which folder').toContain(dir);
    expect(bar, 'and what time it is').toMatch(/\d{2}:\d{2}/);
    // f1 stays: it is the route to every key that is not written on a screen,
    // and the rest of the row is empty anyway.
    expect(bar, 'and the way to the rest of the keys').toContain('f1 for keys');
    await t.unmount();
  });

  it('does not carry what the explorer has highlighted', async () => {
    const { t, quiet } = await open(size);
    // Move the highlight onto something. The tree publishes what is selected
    // whether or not anything is open, which is what used to reach the bar.
    t.press('down');
    await quiet();

    const bar = statusRow(t.lines());
    expect(bar, 'a byte count belongs beside the tree, not here').not.toMatch(/\d+ B\b/);
    expect(bar).not.toContain('KB');
    await t.unmount();
  });
});

describe.each(SIZES)('the pane line at $width x $height', (size) => {
  it('is the file name while reading and the caret while editing', async () => {
    const { t, quiet } = await open(size);

    t.app.store.set('$/ui/editor/uri', `file://${join(dir, 'src', 'a.ts')}`);
    await quiet();
    expect(t.hasText('a.ts'), 'a viewer says which file').toBe(true);

    t.press('ctrl+e');
    await quiet();
    // An editor says where the caret is, because that is the thing a reader
    // has not got and cannot see.
    expect(t.hasText('Ln 1, Col 1'), 'an editor says where the caret is').toBe(true);
    await t.unmount();
  });

  it('says nothing, and costs no row, when there is nothing open', async () => {
    const { t } = await open(size);
    // The empty pane draws its own sentence; what must not be there is a line
    // held open under it for a caption that never arrives.
    expect(t.hasText('Ln '), 'no caret with no file').toBe(false);
    await t.unmount();
  });

  it('no longer repeats keys that are written elsewhere', async () => {
    const { t, quiet } = await open(size);
    t.app.store.set('$/ui/editor/uri', `file://${join(dir, 'README.md')}`);
    await quiet();

    // These were the hints row. `ctrl+p` is in the titlebar and `f1` is in
    // the status bar, so the row was a third copy costing a line of the file.
    const body = t.lines().join('\n');
    expect(body).not.toContain('alt+arrows');
    expect(body).not.toContain('ctrl+c/x/v');
    await t.unmount();
  });
});

describe.each(SIZES)('the explorer footer at $width x $height', (size) => {
  it('says what the highlighted thing is, under the tree that highlighted it', async () => {
    const { t, quiet } = await open(size);
    t.press('down');
    await quiet();

    // The sidebar is the left-hand columns of every row, so the caption has
    // to be inside them rather than merely somewhere on the screen.
    const sidebar = t.lines().map((line) => line.slice(0, 26)).join('\n');
    expect(sidebar, 'the kind of the selected resource').toMatch(/directory|file\./);
    await t.unmount();
  });
});
