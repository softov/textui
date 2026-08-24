import { describe, expect, it } from 'vitest';
import type { Resource, ResourceProvider } from '@textui/core';
import { pick, parentOf, registerBuiltins } from '@textui/widgets';
import { renderApp } from '@textui/testing';

/**
 * Picking a path by looking at it.
 *
 * The point of the component is that you do not have to already know the
 * answer, so the tests walk it the way a person would: type nothing, read what
 * is there, go in, come back out.
 *
 * The provider is a made-up scheme on purpose. A picker that reached for
 * `node:fs` would work on `file:` and nothing else, and the whole reason this
 * reads the resource registry is that the first thing anyone wants to pick off
 * a remote is a file.
 */

const TREE: Record<string, { name: string; directory: boolean }[]> = {
  'mem://root': [
    { name: 'src', directory: true },
    { name: 'docs', directory: true },
    { name: 'README.md', directory: false },
  ],
  'mem://root/src': [
    { name: 'index.ts', directory: false },
    { name: 'deep', directory: true },
  ],
  'mem://root/src/deep': [{ name: 'buried.ts', directory: false }],
  'mem://root/docs': [],
};

function provider(): ResourceProvider {
  const make = (uri: string, name: string, directory: boolean): Resource => ({
    uri,
    kind: directory ? 'directory' : 'file.text',
    metadata: { name },
    capabilities: directory ? ['read', 'list'] : ['read'],
  });
  return {
    scheme: 'mem',
    stat: (uri) => Promise.resolve(make(uri, uri.split('/').pop() ?? uri, uri in TREE)),
    list: (uri) => Promise.resolve(
      (TREE[uri] ?? []).map((e) => make(`${uri}/${e.name}`, e.name, e.directory)),
    ),
    read: () => Promise.resolve(''),
  };
}

const SIZES = [
  { width: 70, height: 20 },
  { width: 110, height: 34 },
] as const;

async function open(size: { width: number; height: number }) {
  const t = await renderApp({
    ...size,
    onBoot: (app) => {
      registerBuiltins(app);
      app.resources.registerProvider(provider());
    },
  });
  const quiet = async (): Promise<void> => {
    for (let i = 0; i < 10; i++) { await t.settle(); t.advance(50); t.flush(); }
  };
  await quiet();
  return { t, quiet };
}

describe('parentOf', () => {
  it.each([
    ['mem://root/src/deep', 'mem://root/src'],
    ['mem://root/src', 'mem://root'],
    // `mem://root` is the top of the scheme. Trimming again gives `mem:/`
    // and then `mem:`, which are two URIs nothing can list.
    ['mem://root', null],
    ['mem://', null],
  ])('%s -> %s', (uri, expected) => {
    expect(parentOf(uri)).toBe(expected);
  });
});

describe.each(SIZES)('picking a file at $width x $height', (size) => {
  it('lists where it starts, folders first', async () => {
    const { t, quiet } = await open(size);
    const answer = pick(t.app, { start: 'mem://root', wants: 'file' });
    await quiet();

    expect(t.hasText('mem://root'), 'says where it is').toBe(true);
    expect(t.hasText('src')).toBe(true);
    expect(t.hasText('README.md')).toBe(true);

    t.press('escape');
    await quiet();
    expect(await answer).toBeNull();
    await t.unmount();
  });

  it('walks in, and comes back out again', async () => {
    const { t, quiet } = await open(size);
    const answer = pick(t.app, { start: 'mem://root', wants: 'file' });
    await quiet();

    // Folders before files, then by name - so `docs` then `src`, and the way
    // onward is not buried among the things at the end of the journey.
    t.press('down');
    t.press('enter');
    await quiet();
    expect(t.hasText('index.ts'), 'went into src').toBe(true);

    t.press('left');
    await quiet();
    expect(t.hasText('README.md'), 'and back out to the root').toBe(true);

    t.press('escape');
    await quiet();
    expect(await answer).toBeNull();
    await t.unmount();
  });

  it('filters as you type, without a second prompt', async () => {
    const { t, quiet } = await open(size);
    const answer = pick(t.app, { start: 'mem://root', wants: 'file' });
    await quiet();

    t.type('READ');
    await quiet();
    expect(t.hasText('README.md')).toBe(true);
    expect(t.hasText('docs'), 'and only what matches').toBe(false);

    t.press('enter');
    expect(await answer).toBe('mem://root/README.md');
    await t.unmount();
  });

  it('will not answer with a folder when a file was asked for', async () => {
    const { t, quiet } = await open(size);
    const answer = pick(t.app, { start: 'mem://root', wants: 'file' });
    await quiet();

    t.type('docs');
    await quiet();
    t.press('enter');
    await quiet();
    // Enter on a folder is a step, not an answer. `docs` is empty, so what
    // proves the step is the empty message rather than a name.
    expect(t.hasText('Nothing here.')).toBe(true);

    t.press('escape');
    await quiet();
    expect(await answer).toBeNull();
    await t.unmount();
  });
});

describe.each(SIZES)('picking a folder at $width x $height', (size) => {
  it('offers the folder you are standing in as a row', async () => {
    const { t, quiet } = await open(size);
    const answer = pick(t.app, { start: 'mem://root/src', wants: 'directory' });
    await quiet();

    // Not a hidden chord: there is no child to press enter on when the answer
    // is the place itself, and a chord for it is a chord nobody finds.
    expect(t.hasText('Use this folder')).toBe(true);
    t.press('enter');
    expect(await answer).toBe('mem://root/src');
    await t.unmount();
  });

  it('still walks through folders on the way', async () => {
    const { t, quiet } = await open(size);
    const answer = pick(t.app, { start: 'mem://root', wants: 'directory' });
    await quiet();

    t.type('src');
    await quiet();
    t.press('down');
    await quiet();
    t.press('enter');
    await quiet();

    expect(t.hasText('mem://root/src'), 'descended').toBe(true);
    t.press('escape');
    await quiet();
    expect(await answer).toBeNull();
    await t.unmount();
  });
});
