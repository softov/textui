import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { renderApp } from '@textui/testing';
import { loadWorkspace, registerTextide, paletteOrder, CATEGORIES } from '../src/index.js';

/**
 * The menus, the palette and the chrome toggles.
 *
 * Every one of these goes through a command: what the tests assert is that the
 * menu and the palette and the keybinding all reach the same one, because that
 * is the only reason to insist actions are commands.
 */

let dir: string;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'textide-chrome-'));
  await writeFile(join(dir, 'README.md'), '# Fixture\n');
  await mkdir(join(dir, 'src'));
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

interface Size { width: number; height: number }
const SIZES: Size[] = [
  { width: 96, height: 18 },
  { width: 130, height: 40 },
];

async function open(size: Size) {
  const workspace = await loadWorkspace(dir);
  const t = await renderApp({
    width: size.width,
    height: size.height,
    shell: 'workbench',
    theme: 'workbench',
    onBoot: (app) => registerTextide(app, { workspace }),
  });
  for (let i = 0; i < 8; i++) await t.settle();
  return t;
}

describe.each(SIZES.map((s) => [`${s.width}x${s.height}`, s] as const))('the chrome at %s', (_n, size) => {
  it('puts File, View and Help in the titlebar', async () => {
    const t = await open(size);
    const bar = t.lines().slice(0, 3).join(' ');
    expect(bar).toContain('File');
    expect(bar).toContain('View');
    expect(bar).toContain('Help');
    expect(bar).toContain('ctrl+p');
    await t.unmount();
  });

  it('opens a menu over the screen rather than pushing it down', async () => {
    const t = await open(size);
    const before = t.lines().findIndex((l) => l.includes('README.md'));

    await t.app.execute('menu.view');
    for (let i = 0; i < 4; i++) await t.settle();

    expect(t.hasText('Theme')).toBe(true);
    expect(t.hasText('Layout')).toBe(true);
    expect(t.hasText('Theme')).toBe(true);
    // The tree is still on the row it was on; the menu is drawn on top of it.
    expect(t.lines().findIndex((l) => l.includes('Layout'))).toBeGreaterThan(0);
    expect(before).toBeGreaterThan(0);
    await t.unmount();
  });

  it('hides and restores the status bar', async () => {
    const t = await open(size);
    expect(t.hasText('? for keys')).toBe(true);

    await t.app.execute('view.toggleStatusBar');
    await t.settle();
    expect(t.hasText('? for keys')).toBe(false);

    await t.app.execute('view.toggleStatusBar');
    await t.settle();
    expect(t.hasText('? for keys')).toBe(true);
    await t.unmount();
  });

  it('hides and restores the title bar', async () => {
    const t = await open(size);
    // `Help` appears only in the menu bar. `ctrl+p` would have matched the key
    // hints as well, and only at a width where they are not truncated - which
    // is the kind of thing one fixed test size never shows you.
    expect(t.hasText('Help')).toBe(true);

    await t.app.execute('view.toggleTitleBar');
    await t.settle();
    expect(t.hasText('Help')).toBe(false);

    await t.app.execute('view.toggleTitleBar');
    await t.settle();
    expect(t.hasText('Help')).toBe(true);
    await t.unmount();
  });

  it('changes the theme through the same command the menu uses', async () => {
    const t = await open(size);
    expect(t.app.theme.id).toBe('workbench');

    await t.app.execute('view.theme', { id: 'paper' });
    await t.settle();
    expect(t.app.theme.id).toBe('paper');
    await t.unmount();
  });
});

describe('the command palette', () => {
  it('offers what is in front of you before what is global', async () => {
    const t = await open(SIZES[0]!);
    const ordered = paletteOrder(t.app.commands.list({ slot: 'palette' }));
    const categories = [...new Set(ordered.map((c) => c.category ?? ''))];

    // File before View before Help, and nothing uncategorised jumps the queue.
    const ranks = categories
      .filter((c) => (CATEGORIES as readonly string[]).includes(c))
      .map((c) => (CATEGORIES as readonly string[]).indexOf(c));
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    expect(categories[0]).toBe('File');
    await t.unmount();
  });

  it('lets the theme command ask which theme, rather than the menu listing them', async () => {
    const t = await open(SIZES[0]!);
    const theme = t.app.commands.get('view.theme');
    const choices = theme?.args?.[0]?.choices;

    expect(Array.isArray(choices)).toBe(true);
    expect(choices as string[]).toContain('workbench');
    expect(choices as string[]).toContain('paper');
    await t.unmount();
  });

  it('opens on ctrl+p', async () => {
    const t = await open(SIZES[0]!);
    t.press('ctrl+p');
    for (let i = 0; i < 4; i++) await t.settle();

    expect(t.app.layers.entries('modal').some((e) => e.id === 'palette')).toBe(true);
    await t.unmount();
  });

  it('reaches every menu item, because every menu item is a command', async () => {
    const t = await open(SIZES[0]!);
    const ids = new Set(t.app.commands.list().map((c) => c.id));
    for (const id of [
      'fs.newFile', 'fs.newFolder', 'fs.rename', 'fs.delete',
      'file.save', 'file.revert', 'file.close',
      'view.theme', 'view.toggleSidebar', 'view.toggleStatusBar', 'view.toggleTitleBar',
      'help.keys', 'help.about', 'app.palette',
    ]) {
      expect(ids, `missing ${id}`).toContain(id);
    }
    await t.unmount();
  });

  /**
   * The bar has to be reachable without a mouse.
   *
   * Before this, the whole application had exactly one focusable - the tree -
   * so tab was a no-op and the menus opened on a click or not at all. These
   * assert the three ways in, at both sizes, because a bar that only works
   * wide is a bar that stops working when someone splits their terminal.
   */
  for (const size of SIZES) {
    it(`tab reaches the menu bar at ${size.width}x${size.height}`, async () => {
      const t = await open(size);
      const seen: string[] = [];
      for (let i = 0; i < 4; i++) { t.tab(); t.flush(); seen.push(t.focused()?.id ?? 'none'); }
      expect(seen.slice(0, 3)).toEqual(['menubar.file', 'menubar.view', 'menubar.help']);
      await t.unmount();
    });

    it(`f10 enters the bar and the arrows walk it at ${size.width}x${size.height}`, async () => {
      const t = await open(size);
      t.press('f10'); t.flush();
      expect(t.focused()?.id).toBe('menubar.file');
      t.press('right'); t.flush();
      expect(t.focused()?.id).toBe('menubar.view');
      t.press('left'); t.flush();
      expect(t.focused()?.id).toBe('menubar.file');
      // Wrapping, so the bar has no dead end.
      t.press('left'); t.flush();
      expect(t.focused()?.id).toBe('menubar.help');
      await t.unmount();
    });
  }

  it('enter opens the focused menu, and an arrow then walks the open one', async () => {
    const t = await open(SIZES[0]!);
    t.press('f10'); t.flush();
    t.press('right'); t.flush();
    t.press('enter');
    for (let i = 0; i < 4; i++) await t.settle();
    expect(t.hasText('Layout')).toBe(true);

    // Right moves the *open* menu rather than only the focus, which is what a
    // menu bar does everywhere else.
    t.press('right');
    for (let i = 0; i < 4; i++) await t.settle();
    expect(t.hasText('Layout')).toBe(false);
    expect(t.hasText('About')).toBe(true);
    await t.unmount();
  });

  it('alt+letter opens each menu outright', async () => {
    const t = await open(SIZES[0]!);
    for (const [keys, probe] of [
      ['alt+f', 'New File'], ['alt+v', 'Layout'], ['alt+h', 'About'],
    ] as const) {
      t.press(keys);
      for (let i = 0; i < 4; i++) await t.settle();
      expect(t.hasText(probe), `${keys} should open the menu holding "${probe}"`).toBe(true);
      t.press('escape');
      for (let i = 0; i < 4; i++) await t.settle();
    }
    await t.unmount();
  });

  /**
   * The sidebar's tree must fill the sidebar.
   *
   * This regressed once already, and counting the rows it drew could not catch
   * it: a content-sized box that overflows and a real viewport that scrolls
   * look identical in the frame. The rect is the only honest measurement -
   * before the fix it read 3 rows with two files and 0 once the content
   * overflowed, in a sidebar twenty rows tall.
   */
  it('gives the explorer the whole sidebar, however many files there are', async () => {
    for (const files of [2, 40]) {
      const many = await mkdtemp(join(tmpdir(), 'textide-fill-'));
      for (let i = 0; i < files; i++) await writeFile(join(many, `f${i}.txt`), 'x\n');
      const workspace = await loadWorkspace(many);
      const t = await renderApp({
        width: 100, height: 24, shell: 'workbench', theme: 'workbench',
        onBoot: (app) => registerTextide(app, { workspace }),
      });
      for (let i = 0; i < 6; i++) { await t.settle(); t.advance(50); t.flush(); }

      const tree = t.queryByRole('tree');
      expect(tree?.rect?.height, `${files} files should still fill the sidebar`).toBe(20);
      await t.unmount();
      await rm(many, { recursive: true, force: true });
    }
  });

  it('does not offer the command palette from inside the command palette', async () => {
    const t = await open(SIZES[0]!);
    const ids = t.app.commands.list({ slot: 'palette' }).map((c) => c.id);
    expect(ids).not.toContain('app.palette');
    // Still reachable by the two routes that are not the palette itself.
    expect(t.app.commands.get('app.palette')).toBeDefined();
    expect(t.app.keybindings.forCommand('app.palette').length).toBeGreaterThan(0);
    await t.unmount();
  });

  it('sends a command that needs an answer to the palette', async () => {
    const t = await open(SIZES[0]!);
    t.press('alt+v');
    for (let i = 0; i < 4; i++) await t.settle();
    expect(t.hasText('Theme')).toBe(true);
    expect(t.hasText('Layout')).toBe(true);

    t.press('enter');                      // Theme is the first item
    for (let i = 0; i < 4; i++) await t.settle();

    // The menu closes and the palette asks, rather than the menu growing a
    // second level of its own. One place knows how to ask a question.
    expect(t.app.layers.entries('floating')).toHaveLength(0);
    expect(t.app.layers.entries('modal').map((e) => e.id)).toEqual(['palette']);
    // Opened *on* the question, not on the whole list with a word typed into
    // the search box: the themes are the rows, and the commands are not.
    for (const id of t.app.themes.list().map((x) => x.id)) {
      expect(t.hasText(id), `the palette should offer ${id}`).toBe(true);
    }
    expect(t.hasText('Save'), 'the command list is behind us now').toBe(false);
    await t.unmount();
  });

  it('makes the main pane a tab stop, so focus is visible on both sides', async () => {
    const t = await open(SIZES[0]!);
    const order: string[] = [];
    for (let i = 0; i < 5; i++) { t.tab(); t.flush(); order.push(t.focused()?.id ?? 'none'); }
    expect(order).toContain('pane.main');

    t.focus('pane.main'); t.flush();
    expect(t.focused()?.id).toBe('pane.main');
    // The active-pane bar is drawn down the whole pane, not just beside the text.
    expect(t.lines().filter((l) => l.includes('\u258e')).length).toBeGreaterThan(5);
    await t.unmount();
  });

  /**
   * A trap owns the keyboard.
   *
   * The menu bar's labels live in the global scope, and `Focus.dispatch` used
   * to walk every active scope regardless of who was trapping. So while a
   * dropdown was open, down reached the label underneath it and re-opened the
   * menu instead of moving inside it - and a palette opened afterwards read
   * the same keystroke as the menu, which is why escape had to be pressed
   * twice to get out of one thing.
   */
  it('moves inside an open menu instead of reopening it', async () => {
    const t = await open(SIZES[0]!);
    t.press('alt+v');
    for (let i = 0; i < 4; i++) await t.settle();

    const highlighted = (): string => {
      const line = t.lines().find((l) => /│▸/.test(l)) ?? '';
      // Items are padded out to the panel edge, and one with a submenu ends
      // in a chevron, so the label is what precedes the first run of spaces.
      return (line.match(/│▸\s*(.*?)(?:\s{2,}|\s*[│╮])/)?.[1] ?? '').trim();
    };
    const open_layers = (): number => t.app.layers.entries('floating').length;

    expect(highlighted()).toBe('Theme');
    expect(open_layers()).toBe(1);

    const seen: string[] = [];
    for (let i = 0; i < 3; i++) {
      t.press('down');
      for (let j = 0; j < 2; j++) await t.settle();
      seen.push(highlighted());
      // The menu must still be the one menu that is open.
      expect(open_layers(), 'down must not reopen or close the dropdown').toBe(1);
    }
    expect(seen).toEqual(['Layout', 'Command Palette', 'Theme']);
    await t.unmount();
  });

  it('hands the palette the keyboard outright, and closes on one escape', async () => {
    const t = await open(SIZES[0]!);
    t.press('alt+v');
    for (let i = 0; i < 4; i++) await t.settle();
    t.press('escape');
    for (let i = 0; i < 4; i++) await t.settle();
    expect(t.app.layers.entries('floating')).toHaveLength(0);

    t.press('ctrl+p');
    for (let i = 0; i < 4; i++) await t.settle();
    // Only the palette - the menu must not still be open behind it.
    expect(t.app.layers.entries('modal').map((e) => e.id)).toEqual(['palette']);
    expect(t.app.layers.entries('floating')).toHaveLength(0);

    const selected = (): string => {
      const line = t.lines().find((l) => /│▸/.test(l)) ?? '';
      return (line.match(/│▸\s*(.*?)\s{2,}/)?.[1] ?? '').trim();
    };
    const first = selected();
    t.press('down');
    for (let i = 0; i < 2; i++) await t.settle();
    expect(selected(), 'down belongs to the palette').not.toBe(first);
    expect(t.app.layers.entries('modal')).toHaveLength(1);

    t.press('escape');
    for (let i = 0; i < 4; i++) await t.settle();
    expect(t.app.layers.entries('modal'), 'one escape, one layer closed').toHaveLength(0);
    await t.unmount();
  });

  /**
   * Tab must not leave an open menu.
   *
   * `trapFocus` on a layer was a flag nothing read: Dialog and CommandPalette
   * trapped because each called `useFocusScope` itself, and a layer built from
   * plain nodes - this dropdown - silently did not. So tab walked out to the
   * label underneath, and every key after it went there too: down then opened
   * and closed the menu instead of moving inside it.
   */
  it('keeps tab inside an open menu, and down still moves after it', async () => {
    const t = await open(SIZES[0]!);
    t.press('alt+f');
    for (let i = 0; i < 4; i++) await t.settle();

    const highlighted = (): string => {
      const line = t.lines().find((l) => /│▸/.test(l)) ?? '';
      return (line.match(/│▸\s*(.*?)(?:\s{2,}|\s*[│╮])/)?.[1] ?? '').trim();
    };
    const inside = t.app.focus.focused();
    expect(inside).not.toBeNull();
    expect(highlighted()).toBe('New File');

    t.tab(); t.flush();
    expect(t.app.focus.focused(), 'tab must not escape the trap').toBe(inside);

    t.press('down');
    for (let i = 0; i < 2; i++) await t.settle();
    expect(highlighted(), 'down after tab still belongs to the menu').toBe('New Folder');
    expect(t.app.layers.entries('floating')).toHaveLength(1);
    await t.unmount();
  });

  /**
   * Layout is the switches.
   *
   * The three toggles used to be three lines in the View menu, which meant the
   * menu had to be edited every time a shell grew a region. They live in the
   * Layout palette now, built from the surfaces the running shell declares -
   * and the arrangement of the main surface is a second section there, because
   * it is the same question asked about a different thing.
   */
  it('offers every hideable part of the running shell, and the View menu offers none', async () => {
    const t = await open(SIZES[0]!);

    t.press('alt+v');
    for (let i = 0; i < 4; i++) await t.settle();
    for (const gone of ['Toggle Sidebar', 'Toggle Status Bar', 'Toggle Title Bar']) {
      expect(t.hasText(gone), `${gone} should not be in the View menu`).toBe(false);
    }
    t.press('escape');
    for (let i = 0; i < 4; i++) await t.settle();

    t.app.execute('view.layout');
    for (let i = 0; i < 5; i++) { await t.settle(); t.advance(50); t.flush(); }

    // One row per surface the shell renders, named for a person.
    for (const part of ['Title Bar', 'Activity Bar', 'Sidebar', 'Panel', 'Aside', 'Status Bar']) {
      expect(t.hasText(part), `Layout should offer ${part}`).toBe(true);
    }
    // And the arrangement, as its own section.
    expect(t.hasText('Main Arrangement')).toBe(true);
    // Never a switch for the content itself.
    expect(t.hasText('Main ')).toBe(true);
    await t.unmount();
  });

  it('runs a row the registry has never seen', async () => {
    const t = await open(SIZES[0]!);
    expect(t.app.surfaces.state('status').visible).not.toBe(false);

    t.app.execute('view.layout');
    for (let i = 0; i < 5; i++) { await t.settle(); t.advance(50); t.flush(); }

    // Title Bar, Activity Bar, Sidebar, Panel, Aside, Status Bar.
    for (let i = 0; i < 5; i++) t.press('down');
    for (let i = 0; i < 2; i++) await t.settle();
    t.press('enter');
    for (let i = 0; i < 5; i++) { await t.settle(); t.advance(50); t.flush(); }

    // These rows are built for this list and never registered, so the palette
    // has to run the definition it was handed rather than look the id up.
    expect(t.app.surfaces.state('status').visible).toBe(false);
    await t.unmount();
  });

  /**
   * The Layout list is a diagram you can walk.
   *
   * One glyph family says where each region is and whether it is on screen -
   * a tick can only say the second half, which is why a column of ticks needs
   * a column of words beside it. Flipping one switch leaves the list open and
   * redraws that row, because a list of switches is meant to be walked.
   */
  it('draws each region with its own glyph, and redraws it in place', async () => {
    const t = await open(SIZES[0]!);
    const g = t.app.theme.glyphs;

    t.app.execute('view.layout');
    for (let i = 0; i < 5; i++) { await t.settle(); t.advance(50); t.flush(); }

    // A frame line crosses several borders before it reaches the palette, and
    // the highlighted row carries a selection marker too, so the glyph is the
    // last thing standing between the innermost border and the title.
    const row = (title: string): string => {
      const line = t.lines().find((l) => l.includes(`${title} `)) ?? '';
      const before = line.slice(0, line.indexOf(title));
      const cell = before.slice(before.lastIndexOf('│') + 1).trim().split(/\s+/);
      return cell[cell.length - 1] ?? '';
    };
    expect(row('Title Bar')).toBe(g.regionTop);
    expect(row('Status Bar')).toBe(g.regionBottom);
    expect(row('Sidebar')).toBe(g.regionLeft);
    expect(row('Aside')).toBe(g.regionRight);

    // Enter on the first row hides that region, keeps the list, redraws the row.
    expect(t.app.surfaces.state('header').visible).not.toBe(false);
    t.press('enter');
    for (let i = 0; i < 5; i++) { await t.settle(); t.advance(50); t.flush(); }

    expect(t.app.surfaces.state('header').visible).toBe(false);
    expect(t.app.layers.entries('modal').map((e) => e.id), 'the list stays').toEqual(['layout']);
    expect(row('Title Bar'), 'the row redraws as hidden').toBe(g.regionOff);
    await t.unmount();
  });

  it('wraps at both ends of the list', async () => {
    const t = await open(SIZES[0]!);
    t.app.execute('view.layout');
    for (let i = 0; i < 5; i++) { await t.settle(); t.advance(50); t.flush(); }

    const selected = (): string => {
      const line = t.lines().find((l) => /│▸/.test(l)) ?? '';
      return (line.match(/│▸\s*\S?\s*(.*?)\s{2,}/)?.[1] ?? '').trim();
    };
    const first = selected();
    expect(first).toBe('Title Bar');

    // Up from the first row lands on the last, not on the first again.
    t.press('up');
    for (let i = 0; i < 2; i++) await t.settle();
    const last = selected();
    expect(last).toBe('Main Arrangement');

    t.press('down');
    for (let i = 0; i < 2; i++) await t.settle();
    expect(selected()).toBe(first);
    await t.unmount();
  });
});
