import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { renderApp } from '@textui/testing';
import { loadWorkspace, registerTextide } from '../src/index.js';
import { shortcutSheet } from '../src/commands.js';

/**
 * The two sidebar keys, which are the same letter and mean different things.
 *
 * `ctrl+b` is whether the sidebar is showing; `ctrl+shift+b` is which panel is
 * in it. They are worth a test together because the second was unreachable
 * until strokes could carry shift beside another modifier - it normalised to
 * the first, and pressing it just collapsed the sidebar.
 */
const SIZES = [
  { width: 96, height: 22 },
  { width: 130, height: 40 },
] as const;

let dir: string;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'textide-sidebar-'));
  await writeFile(join(dir, 'README.md'), '# Fixture\n');
  await mkdir(join(dir, 'src'));
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function open(size: { width: number; height: number }) {
  const workspace = await loadWorkspace(dir);
  const t = await renderApp({
    width: size.width,
    height: size.height,
    shell: 'workbench',
    theme: 'workbench',
    onBoot: (app) => registerTextide(app, { workspace }),
  });
  for (let i = 0; i < 10; i++) { await t.settle(); t.advance(50); t.flush(); }
  return t;
}

describe.each(SIZES)('the sidebar keys at $width x $height', (size) => {
  it('ctrl+b hides the sidebar and ctrl+b again brings it back', async () => {
    const t = await open(size);
    const collapsed = (): boolean => t.app.store.get<boolean>('$/ui/sidebar/collapsed') === true;
    expect(collapsed()).toBe(false);

    t.press('ctrl+b');
    await t.settle();
    expect(collapsed()).toBe(true);

    t.press('ctrl+b');
    await t.settle();
    expect(collapsed()).toBe(false);
    await t.unmount();
  });

  it('ctrl+shift+b asks which panel instead of hiding it', async () => {
    const t = await open(size);
    t.press('ctrl+shift+b');
    for (let i = 0; i < 10; i++) { await t.settle(); t.advance(50); t.flush(); }

    // The sidebar is still there - this key is not the other one.
    expect(t.app.store.get<boolean>('$/ui/sidebar/collapsed')).toBe(false);
    // And the palette is open, already drilled into the panel list rather
    // than showing the whole command registry.
    expect(t.app.layers.entries().map((e) => e.id)).toContain('palette');
    expect(t.hasText('Explorer'), 'the panels are the choices').toBe(true);
    expect(t.hasText('Command Palette'), 'not the command list').toBe(false);

    t.press('escape');
    await t.settle();
    await t.unmount();
  });
});

describe('what the shortcut sheet says about them', () => {
  it('names each key by what it does, not by the command it runs', async () => {
    const t = await open(SIZES[0]);
    const sheet = shortcutSheet(t.app);
    expect(sheet).toContain('Show or Hide the Sidebar');
    expect(sheet).toContain('Choose a Sidebar Panel');
    // `app.palette` keeps its own keys, and does not acquire this one.
    expect(t.app.keybindings.forCommand('app.palette')).toEqual(['ctrl+p', 'ctrl+k']);
    await t.unmount();
  });
});
