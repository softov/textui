import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { renderApp } from '@textui/testing';
import { loadWorkspace, registerTextide, ASCII_ICONS } from '../src/index.js';

/**
 * The terminal textide is not running on.
 *
 * Detection is right almost always, and the times it is not are the times
 * nobody is watching: a console with no dingbats, a link with sixteen colours.
 * `--unicode` and `--colors` are how that terminal gets looked at from this
 * one, and these are the tests that say the fallback is real rather than
 * declared.
 */

let dir: string;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'textide-caps-'));
  await writeFile(join(dir, 'README.md'), '# Fixture\n\nSome prose.\n');
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function open(capabilities?: Record<string, unknown>, shots?: string) {
  const workspace = await loadWorkspace(dir);
  const t = await renderApp({
    width: 96,
    height: 20,
    shell: 'workbench',
    theme: 'workbench',
    ...(capabilities ? { capabilities } : {}),
    onBoot: (app) => registerTextide(app, { workspace, ...(shots ? { shots } : {}) }),
  });
  for (let i = 0; i < 8; i++) await t.settle();
  return t;
}

describe('on a terminal that can only do ASCII', () => {
  it('draws nothing that terminal cannot draw', async () => {
    const t = await open({ unicode: 'ascii', wideChars: false });
    await t.app.execute('app.palette');
    for (let i = 0; i < 4; i++) await t.settle();

    const screen = t.text();
    const offending = [...screen].filter((c) => (c.codePointAt(0) as number) > 0x7f);
    // Not "mostly ASCII". One `⌸` left in a fallback fails on exactly the
    // terminal the fallback exists for, and nowhere else.
    expect([...new Set(offending)]).toEqual([]);
    await t.unmount();
  });

  it('still shows an icon beside a command, from the ASCII set', async () => {
    const t = await open({ unicode: 'ascii', wideChars: false });
    await t.app.execute('app.palette');
    for (let i = 0; i < 4; i++) await t.settle();

    t.type('Screensh');
    for (let i = 0; i < 4; i++) await t.settle();

    const row = t.lines().find((line) => line.includes('Screenshot'));
    expect(row).toBeDefined();
    expect(row).toContain(ASCII_ICONS.camera);
    await t.unmount();
  });

  it('keeps every row inside the frame it was given', async () => {
    // A fallback that is two cells wide is worse than the glyph it replaced.
    const t = await open({ unicode: 'ascii', wideChars: false });
    expect(t.lines().every((line) => line.length <= 96)).toBe(true);
    await t.unmount();
  });
});

describe('the screenshot command', () => {
  it('writes the frame that is on screen, in colour and in plain', async () => {
    const t = await open(undefined, dir);
    const before = t.text();

    await t.app.execute('view.screenshot');
    for (let i = 0; i < 4; i++) await t.settle();

    // The toast says where it went, which is the only way a person running a
    // full-screen application finds out.
    const toast = t.lines().find((line) => line.includes('.ans'));
    expect(toast).toBeDefined();

    const path = /(\S+\.ans)/.exec(toast as string)?.[1] as string;
    const plain = await readFile(path.replace(/\.ans$/, '.txt'), 'utf8');
    const coloured = await readFile(path, 'utf8');

    // The plain copy is the frame as it was before the toast landed on it.
    expect(plain.trimEnd()).toBe(before.trimEnd());
    expect(coloured).toContain('\x1b[');
    // And the colour copy says the same thing once the colour is taken off.
    // eslint-disable-next-line no-control-regex
    const SGR = /\x1b\[[0-9;]*m/g;
    expect(coloured.replace(SGR, '').trimEnd()).toBe(plain.trimEnd());
    await t.unmount();
  });
});
