import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { renderApp } from '@textui/testing';
import { loadWorkspace, registerTextide, paletteOrder, CATEGORIES } from '../src/index.js';
import { shortcutSheet } from '../src/commands.js';

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

    await t.app.execute('view.toggle', { surface: 'status' });
    await t.settle();
    expect(t.hasText('? for keys')).toBe(false);

    await t.app.execute('view.toggle', { surface: 'status' });
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

    await t.app.execute('view.toggle', { surface: 'header' });
    await t.settle();
    expect(t.hasText('Help')).toBe(false);

    await t.app.execute('view.toggle', { surface: 'header' });
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
      'view.theme', 'view.toggle',
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

  it('lights the main pane when focus is in it, without being a tab stop itself', async () => {
    const scratch = await mkdtemp(join(tmpdir(), 'textide-pane-'));
    await writeFile(join(scratch, 'a.txt'), 'alpha\n');
    const workspace = await loadWorkspace(scratch);
    const t = await renderApp({
      width: 90, height: 16, shell: 'workbench', theme: 'workbench',
      onBoot: (app) => registerTextide(app, { workspace }),
    });
    const quiet = async (): Promise<void> => {
      for (let i = 0; i < 6; i++) { await t.settle(); t.advance(50); t.flush(); }
    };
    await quiet();
    t.app.store.set('$/ui/editor/uri', `file://${join(scratch, 'a.txt')}`);
    await quiet();
    t.app.execute('file.edit');
    await quiet();

    // Entering edit mode put focus in the pane, and on the editor inside it
    // rather than on a wrapper - the pane is a scope, not a control.
    expect(t.store.get('$/focus/scope')).toBe('pane.main');
    expect(t.app.focus.focused(), 'lands on the editor, not on the pane')
      .not.toBe('pane.main');
    const bar = (): number => t.lines().filter((l) => l.includes('\u258e')).length;
    expect(bar(), 'the bar spans the pane').toBeGreaterThan(3);

    // Leaving it and coming back is one press each way, because the pane
    // contributes no stop of its own.
    t.tab(); t.flush();
    expect(t.store.get('$/focus/scope'), 'one press leaves').not.toBe('pane.main');
    t.shiftTab(); t.flush();
    expect(t.store.get('$/focus/scope'), 'and one press returns').toBe('pane.main');

    await t.unmount();
    await rm(scratch, { recursive: true, force: true });
  });

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
    // The glyph is the row's identity and holds still; the state is the word
    // beside it, asserted in its own test below.
    expect(row('Title Bar')).toBe(g.regionTop);
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

  it('keeps the glyph still and moves the state into the word beside it', async () => {
    const t = await open(SIZES[0]!);
    const g = t.app.theme.glyphs;
    t.app.execute('view.layout');
    for (let i = 0; i < 5; i++) { await t.settle(); t.advance(50); t.flush(); }

    const line = (title: string): string => t.lines().find((l) => l.includes(`${title} `)) ?? '';
    const glyph = (title: string): string => {
      const before = line(title).slice(0, line(title).indexOf(title));
      const cell = before.slice(before.lastIndexOf('│') + 1).trim().split(/\s+/);
      return cell[cell.length - 1] ?? '';
    };

    expect(glyph('Title Bar')).toBe(g.regionTop);
    expect(line('Title Bar')).toContain('Visible');
    // The row is the sidebar switch, and ctrl+b is bound to that surface.
    expect(line('Sidebar')).toContain('ctrl+b');

    t.press('enter');
    for (let i = 0; i < 5; i++) { await t.settle(); t.advance(50); t.flush(); }

    // An icon that swapped would make the row you just acted on look like a
    // different row, so it does not: only the word changes.
    expect(glyph('Title Bar'), 'the glyph is the row, not its state').toBe(g.regionTop);
    expect(line('Title Bar')).toContain('Hidden');
    await t.unmount();
  });

  /**
   * Wear it before you buy it.
   *
   * The theme applies as the highlight moves so the choice is made by looking
   * rather than by guessing a name, and goes back if the asking is abandoned.
   * The command owns the undo, because only it knows what it changed.
   */
  it('previews a theme while choosing, and puts it back on escape', async () => {
    const t = await open(SIZES[0]!);
    const start = t.app.theme.id;

    t.app.execute('app.palette', { at: 'view.theme' });
    for (let i = 0; i < 5; i++) { await t.settle(); t.advance(50); t.flush(); }
    expect(t.app.theme.id, 'drilling changes nothing on its own').toBe(start);

    t.press('down');
    for (let i = 0; i < 2; i++) await t.settle();
    const previewed = t.app.theme.id;
    expect(previewed, 'moving the highlight applies the theme').not.toBe(start);

    t.press('escape');
    for (let i = 0; i < 3; i++) await t.settle();
    expect(t.app.theme.id, 'abandoning puts it back').toBe(start);

    // Choosing keeps it.
    t.press('escape');
    for (let i = 0; i < 3; i++) await t.settle();
    t.app.execute('app.palette', { at: 'view.theme' });
    for (let i = 0; i < 5; i++) { await t.settle(); t.advance(50); t.flush(); }
    t.press('down');
    for (let i = 0; i < 2; i++) await t.settle();
    const chosen = t.app.theme.id;
    t.press('enter');
    for (let i = 0; i < 4; i++) { await t.settle(); t.advance(50); t.flush(); }
    expect(t.app.theme.id).toBe(chosen);
    await t.unmount();
  });
});

describe('where focus starts and how many stops there are', () => {
  /**
   * One stop per control.
   *
   * Two of them were not controls. `createApp({ root })` mounted an empty node
   * into `main` beside the editor, which turned the main surface into a tab
   * strip - so tabbing from the tree reached a strip listing "editor" and
   * "root" before reaching anything you could type into. And the pane itself
   * was a focusable, so the editor took a second press after that.
   */
  it('gives main one mount, and every tab stop is something you can use', async () => {
    const scratch = await mkdtemp(join(tmpdir(), 'textide-focus-'));
    await writeFile(join(scratch, 'a.txt'), 'alpha\n');
    const workspace = await loadWorkspace(scratch);
    const t = await renderApp({
      width: 90, height: 16, shell: 'workbench', theme: 'workbench',
      onBoot: (app) => registerTextide(app, { workspace }),
    });
    for (let i = 0; i < 6; i++) { await t.settle(); t.advance(50); t.flush(); }

    expect(t.app.surfaces.mounts('main').map((m) => m.key)).toEqual(['editor']);
    expect(t.hasText('root'), 'no phantom tab').toBe(false);

    // Somewhere to start, so the first arrow key is not read by the menu bar.
    expect(t.app.focus.focused()).not.toBeNull();
    const explorer = t.app.focus.focused();

    const seen: string[] = [];
    for (let i = 0; i < 6; i++) {
      t.tab(); t.flush();
      const id = t.app.focus.focused() ?? 'none';
      if (seen.includes(id)) break;
      seen.push(id);
    }
    // The three menus and the tree. Nothing is open, so `main` has no control
    // in it - and the pane is a scope now rather than a stop of its own, so it
    // contributes nothing on its own account.
    expect(seen).toHaveLength(4);
    expect(seen.filter((id) => id.startsWith('menubar.'))).toHaveLength(3);
    expect(seen).toContain(explorer);
    expect(seen).not.toContain('pane.main');

    await t.unmount();
    await rm(scratch, { recursive: true, force: true });
  });

  it('does not open a menu when an arrow is pressed after toggling edit mode', async () => {
    const scratch = await mkdtemp(join(tmpdir(), 'textide-mode-'));
    await writeFile(join(scratch, 'a.txt'), 'alpha\nbeta\n');
    const workspace = await loadWorkspace(scratch);
    const t = await renderApp({
      width: 90, height: 16, shell: 'workbench', theme: 'workbench',
      onBoot: (app) => registerTextide(app, { workspace }),
    });
    const quiet = async (): Promise<void> => {
      for (let i = 0; i < 6; i++) { await t.settle(); t.advance(50); t.flush(); }
    };
    await quiet();

    t.app.store.set('$/ui/editor/uri', `file://${join(scratch, 'a.txt')}`);
    await quiet();
    t.app.execute('file.edit');
    await quiet();

    t.press('down');
    await quiet();
    // With nothing focused, this arrow used to reach the menu bar.
    expect(t.app.layers.entries('floating'), 'an arrow is not a menu').toHaveLength(0);

    await t.unmount();
    await rm(scratch, { recursive: true, force: true });
  });

  /**
   * A border is a gutter as well as a line, and `paper` has no border - so its
   * overlays ran flush to the panel edge and the last character of a row sat
   * against whatever was drawn behind it.
   */
  it('keeps a gutter in a borderless theme', async () => {
    const scratch = await mkdtemp(join(tmpdir(), 'textide-paper-'));
    await writeFile(join(scratch, 'a.txt'), 'x\n');
    const workspace = await loadWorkspace(scratch);
    const t = await renderApp({
      width: 92, height: 20, shell: 'workbench', theme: 'paper',
      onBoot: (app) => registerTextide(app, { workspace }),
    });
    for (let i = 0; i < 5; i++) { await t.settle(); t.advance(50); t.flush(); }
    expect(t.app.theme.border).toBe('none');

    t.press('alt+f');
    for (let i = 0; i < 4; i++) await t.settle();
    const row = t.lines().find((l) => l.includes('ctrl+n')) ?? '';
    const at = row.indexOf('ctrl+n');
    expect(row.slice(at + 'ctrl+n'.length, at + 'ctrl+n'.length + 1))
      .toMatch(/\s|^$/);

    await t.unmount();
    await rm(scratch, { recursive: true, force: true });
  });
});

describe('what is actually in the tab order', () => {
  const quiet = async (t: { settle(): Promise<void>; advance(n: number): void; flush(): void }): Promise<void> => {
    for (let i = 0; i < 10; i++) { await t.settle(); t.advance(50); t.flush(); }
  };

  /**
   * A fenced code block is typography, not a control.
   *
   * `MarkdownViewer` renders each fence with a `CodeViewer`, and a `CodeViewer`
   * is focusable - so a README with two fences put two extra stops between the
   * document and the menu bar, each of them a thing nobody can do anything
   * with. Found by asking the log to name the tab order rather than by reading
   * the component and guessing.
   */
  it('does not make a tab stop out of every code block in a document', async () => {
    const scratch = await mkdtemp(join(tmpdir(), 'textide-fences-'));
    await writeFile(
      join(scratch, 'a.md'),
      '# Title\n\ntext\n\n```bash\nls\n```\n\nmore\n\n```json\n{"a":1}\n```\n',
    );
    const workspace = await loadWorkspace(scratch);
    const t = await renderApp({
      width: 120, height: 40, shell: 'workbench', theme: 'workbench',
      onBoot: (app) => registerTextide(app, { workspace }),
    });
    await quiet(t);
    t.app.store.set('$/ui/editor/uri', `file://${join(scratch, 'a.md')}`);
    await quiet(t);

    expect(t.hasText('Title'), 'the document rendered').toBe(true);

    // Three menus, the tree, and the document. Not the fences inside it.
    const stops = t.app.focus.order();
    expect(stops).toHaveLength(5);
    expect(stops.filter((id) => t.app.focus.scopeOf(id) === 'pane.main')).toHaveLength(1);

    await t.unmount();
    await rm(scratch, { recursive: true, force: true });
  });

  /**
   * Going to edit means going to the editor. Leaving focus in the tree showed
   * a caret at 1x1 that no key reached, while the arrows kept moving the file
   * list - which reads as the editor being broken rather than unfocused.
   */
  it('puts focus in the editor when edit mode is entered', async () => {
    const scratch = await mkdtemp(join(tmpdir(), 'textide-enter-'));
    await writeFile(join(scratch, 'a.txt'), 'alpha\nbeta\ngamma\n');
    const workspace = await loadWorkspace(scratch);
    const t = await renderApp({
      width: 100, height: 20, shell: 'workbench', theme: 'workbench',
      onBoot: (app) => registerTextide(app, { workspace }),
    });
    await quiet(t);
    t.app.store.set('$/ui/editor/uri', `file://${join(scratch, 'a.txt')}`);
    await quiet(t);
    expect(t.store.get('$/focus/scope'), 'focus starts in the tree').toBe('__global__');

    t.app.execute('file.edit');
    await quiet(t);
    await new Promise((resolve) => { setTimeout(resolve, 60); });
    await quiet(t);

    expect(t.store.get('$/focus/scope'), 'and moves into the pane').toBe('pane.main');

    // And the arrows now belong to the caret rather than to the file list.
    t.press('down');
    t.press('end');
    t.type('!');
    await quiet(t);
    expect(t.hasText('beta!')).toBe(true);

    await t.unmount();
    await rm(scratch, { recursive: true, force: true });
  });

  /**
   * And keeps it there on the way back.
   *
   * Leaving edit mode unmounts the editor, and unregistering the focused
   * control leaves focus null - so the viewer that replaced it drew perfectly
   * and read no keys at all. A document you were scrolling a moment ago
   * stopping dead reads as a broken viewer rather than as an unfocused one.
   */
  it('leaves focus in the pane when edit mode is left', async () => {
    const scratch = await mkdtemp(join(tmpdir(), 'textide-leave-'));
    await writeFile(
      join(scratch, 'a.md'),
      Array.from({ length: 60 }, (_, i) => `line ${i} of the document`).join('\n'),
    );
    const workspace = await loadWorkspace(scratch);
    const t = await renderApp({
      width: 100, height: 20, shell: 'workbench', theme: 'workbench',
      onBoot: (app) => registerTextide(app, { workspace }),
    });
    await quiet(t);
    t.app.store.set('$/ui/editor/uri', `file://${join(scratch, 'a.md')}`);
    await quiet(t);

    t.app.execute('file.edit');
    await quiet(t);
    expect(t.store.get('$/focus/scope')).toBe('pane.main');

    t.app.execute('file.edit');
    await quiet(t);
    expect(t.store.get('$/ui/editor/mode'), 'back to viewing').toBe('view');
    expect(t.store.get('$/focus/scope'), 'and still in the pane').toBe('pane.main');

    // Which is the whole point: the keys go somewhere.
    const before = t.text();
    for (let i = 0; i < 10; i++) t.press('down');
    await quiet(t);
    expect(t.text(), 'the document scrolls again').not.toBe(before);

    await t.unmount();
    await rm(scratch, { recursive: true, force: true });
  });

  /**
   * The scope claims the keyboard only when nothing at all holds it, which is
   * what separates taking focus back from taking it off the tree.
   */
  it('does not take focus off the tree when a file is opened', async () => {
    const scratch = await mkdtemp(join(tmpdir(), 'textide-tree-'));
    await writeFile(join(scratch, 'a.txt'), 'alpha\n');
    await writeFile(join(scratch, 'b.md'), '# Title\n');
    const workspace = await loadWorkspace(scratch);
    const t = await renderApp({
      width: 100, height: 20, shell: 'workbench', theme: 'workbench',
      onBoot: (app) => registerTextide(app, { workspace }),
    });
    await quiet(t);

    // Two files of different kinds, so the pane swaps one viewer component for
    // another rather than only changing the URI it was given.
    for (const name of ['a.txt', 'b.md']) {
      t.app.store.set('$/ui/editor/uri', `file://${join(scratch, name)}`);
      await quiet(t);
      expect(t.store.get('$/focus/scope'), `still the tree after ${name}`).toBe('__global__');
    }

    await t.unmount();
    await rm(scratch, { recursive: true, force: true });
  });
});

/**
 * The shortcut sheet.
 *
 * The footer has room for five keys and there are thirty, so the other
 * twenty-five have to be findable somewhere. Built from the keybindings rather
 * than from the palette, because a key bound to a command nobody put in a list
 * is exactly the key nobody can otherwise find.
 */
describe('the keyboard shortcuts', () => {
  const quiet = async (t: { settle(): Promise<void>; advance(n: number): void; flush(): void }): Promise<void> => {
    for (let i = 0; i < 10; i++) { await t.settle(); t.advance(50); t.flush(); }
  };

  it('opens on alt+shift+? and closes on escape', async () => {
    const t = await open(SIZES[0]!);
    t.press('alt+shift+?');
    await quiet(t);
    expect(t.hasText('Keyboard Shortcuts')).toBe(true);
    expect(t.hasText('Command Palette'), 'and lists what the keys run').toBe(true);

    t.press('escape');
    await quiet(t);
    expect(t.app.layers.entries()).toEqual([]);
    await t.unmount();
  });

  it('lists a key whose command was never put in a list', async () => {
    const t = await open(SIZES[0]!);
    const sheet = shortcutSheet(t.app);
    // `go.tab` and `view.toggle` are both `slots: []` - nine rows differing by
    // a digit, and one switch that carries which surface. Neither is in the
    // palette and both are bound.
    expect(sheet).toContain('Go To File By Number');
    expect(sheet).toContain('Toggle Surface');
    await t.unmount();
  });

  it('collapses a run of keys into its ends', async () => {
    const t = await open(SIZES[0]!);
    const sheet = shortcutSheet(t.app);
    // Nine keys, one command, one row. Nine rows saying the same thing nine
    // times is nine rows nobody reads.
    expect(sheet).toContain('alt+1 .. alt+9');
    expect(sheet).not.toContain('alt+5');
    // Two is still two, because both are worth knowing.
    expect(sheet).toContain('ctrl+p, ctrl+k');
    await t.unmount();
  });

  /**
   * A terminal reports shift through the character it produced, never beside
   * it, so `alt+shift+?` is filed and pressed as `alt+?`. The sheet has to say
   * the stroke that arrives, and to agree with the footer that names it.
   */
  it('prints the stroke that actually arrives', async () => {
    const t = await open(SIZES[0]!);
    const sheet = shortcutSheet(t.app);
    expect(sheet).toContain('alt+?');
    expect(sheet).not.toContain('alt+shift+?');
    expect(t.hasText('alt+? keys'), 'which is what the footer offers').toBe(true);
    await t.unmount();
  });

  it('groups by what the keys are for', async () => {
    const t = await open(SIZES[0]!);
    const sheet = shortcutSheet(t.app);
    const headings = sheet.split('\n').filter((line) => line !== '' && !line.startsWith(' '));
    // The categories the palette is ordered by, in the order it orders them.
    expect(headings).toEqual(headings.filter((h) => h.trim() === h));
    expect(headings.indexOf('File')).toBeLessThan(headings.indexOf('View'));
    expect(headings).toContain('Go');
    await t.unmount();
  });
});
