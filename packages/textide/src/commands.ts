import type {
  LayoutName, SurfaceName, CommandDefinition, CommandContext, TextUIApp, BindingPath, ThemeGlyphs,
} from '@textui/core';
import { notify } from '@textui/core';
import {
  canRedoDocument, canUndoDocument, getDocument, isDocumentDirty, redoDocument,
  revertDocument, saveDocument, undoDocument,
} from '@textui/documents';
import { ACTIVE_PATH } from './filesystem.js';
import { iconsFor } from './icons.js';

/**
 * textide's own commands.
 *
 * Everything the menus and the palette offer is a command, and nothing else
 * is. A menu item that calls a function directly is a second implementation
 * of the same action, and it is the one that will not have a keybinding, will
 * not appear in the palette, and will not be disabled when it should be.
 *
 * `category` is what orders the palette: file commands are about the thing in
 * front of you, so they come first.
 */

export const EDITOR_URI = '$/ui/editor/uri' as BindingPath;
export const CHROME_PATH = '$/ui/chrome' as BindingPath;

/** Categories, in the order the palette should offer them. */
export const CATEGORIES = ['File', 'Edit', 'View', 'Go', 'Help'] as const;

function openUri(ctx: CommandContext): string | null {
  return ctx.store.get<string>(EDITOR_URI) ?? null;
}

/**
 * Show or hide one surface, whatever it is called.
 *
 * Takes any name rather than three known ones: the shell decides which
 * surfaces exist, so the list of things a person can hide is a property of the
 * running shell and not of this file.
 */
function toggleSurface(app: TextUIApp, key: SurfaceName): boolean {
  // The sidebar collapses rather than unmounting, because the shell reserves
  // its column either way and a collapsed sidebar has to leave no gutter.
  if (key === 'sidebar') {
    const next = !(app.store.get<boolean>('$/ui/sidebar/collapsed') ?? false);
    app.store.set('$/ui/sidebar/collapsed', next);
    return !next;
  }
  // A surface that is not visible renders nothing and costs no rows, which is
  // the whole of what "hide the status bar" means.
  const visible = app.surfaces.state(key).visible !== false;
  app.surfaces.setState(key, { visible: !visible });
  app.store.set(`${CHROME_PATH}/${key}` as BindingPath, !visible);
  return !visible;
}

/** What a surface is called when a person is asked whether to show it. */
const SURFACE_TITLES: Record<string, string> = {
  header: 'Title Bar',
  rail: 'Activity Bar',
  sidebar: 'Sidebar',
  aside: 'Aside',
  panel: 'Panel',
  status: 'Status Bar',
};

/**
 * The key bound to flipping this surface, if one is.
 *
 * `forCommand` cannot answer it: every switch is the same command, and what
 * separates them is the argument the binding carries.
 */
function shortcutFor(app: TextUIApp, surface: SurfaceName): string | undefined {
  return app.keybindings.list()
    .find((b) => b.commandId === TOGGLE_COMMAND && b.args?.surface === surface)
    ?.keys;
}

/** The one command every surface switch runs. */
export const TOGGLE_COMMAND = 'view.toggle';

/** Which edge of the frame a surface lives on, as a theme glyph role. */
const SURFACE_EDGE: Record<string, keyof ThemeGlyphs> = {
  header: 'regionTop',
  status: 'regionBottom',
  sidebar: 'regionLeft',
  rail: 'regionLeft',
  aside: 'regionRight',
  panel: 'regionBottom',
  main: 'regionCentre',
};

/** Surfaces nobody should be offered a switch for. */
const NEVER_HIDEABLE = new Set(['main', 'overlay', 'notify']);

function titleFor(surface: string): string {
  return SURFACE_TITLES[surface]
    ?? surface.replace(/[:_-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * The rows the Layout palette shows.
 *
 * Two sections, because they are two different questions: which parts are on
 * screen, and how the main surface arranges what is in it. They are both
 * "layout", and neither belongs as a line in a menu - one is a list that grows
 * with the shell, the other is a choice.
 *
 * The hideable parts come from the shell that is actually running rather than
 * from a list kept here, so a shell with a `lateral1` gets a switch for it
 * without this file knowing the name.
 */
export function layoutCommands(app: TextUIApp): CommandDefinition[] {
  const shellId = app.store.get<string>('$/layout/shell' as BindingPath) ?? '';
  const shell = app.shells.get(shellId);
  const surfaces = (shell?.surfaces ?? []).filter((s) => !NEVER_HIDEABLE.has(s));

  const toggles: CommandDefinition[] = surfaces.map((surface) => {
    const shown = surface === 'sidebar'
      ? !(app.store.get<boolean>('$/ui/sidebar/collapsed') ?? false)
      : app.surfaces.state(surface).visible !== false;
    // The glyph says which edge, and never changes: an icon that swaps as you
    // toggle makes the row you just acted on look like a different row. The
    // state goes in the word beside it.
    const edge = SURFACE_EDGE[surface] ?? 'regionCentre';
    const bound = shortcutFor(app, surface);
    return {
      id: `view.toggle:${surface}`,
      title: titleFor(surface),
      category: 'Layout',
      icon: String(app.theme.glyphs[edge]),
      badge: shown ? 'Visible' : 'Hidden',
      description: `${shown ? 'Hide' : 'Show'} the ${titleFor(surface).toLowerCase()}`,
      // The row is a switch, and the key bound to that switch is the key
      // bound to this surface - not to a command named after it.
      ...(bound ? { shortcut: bound } : {}),
      // Flipping one switch should not put the list away.
      keepOpen: true,
      slots: [],
      run: () => { toggleSurface(app, surface); },
    };
  });

  const arrangement = app.commands.get('view.arrangement');
  return arrangement
    ? [...toggles, { ...arrangement, category: 'Arrange' }]
    : toggles;
}

/** What the theme was before a preview started, until it is kept or dropped. */
let previousTheme: string | null = null;

export function textideCommands(app: TextUIApp): CommandDefinition[] {
  const themes = app.themes.list().map((t) => t.id);
  // Asked once, here, rather than at each icon: which marks this terminal can
  // draw is a property of the terminal, and a command list is built after it
  // is known.
  const Icon = iconsFor(app.capabilities.unicode);

  return [
    // --- File: about the thing in front of you -----------------------------
    {
      id: 'file.save',
      icon: Icon.save,
      title: 'Save',
      category: 'File',
      slots: ['palette'],
      run: async (_args: Record<string, unknown>, ctx: CommandContext) => {
        const uri = openUri(ctx);
        if (!uri) return;
        if (!isDocumentDirty(ctx.store, uri)) {
          notify(ctx.app, { message: 'Nothing to save.' });
          return;
        }
        await saveDocument(ctx.app, uri);
        notify(ctx.app, { tone: 'success', message: 'Saved.' });
      },
    },
    {
      id: 'file.revert',
      icon: Icon.revert,
      title: 'Revert',
      category: 'File',
      slots: ['palette'],
      run: (_args: Record<string, unknown>, ctx: CommandContext) => {
        const uri = openUri(ctx);
        if (uri) revertDocument(ctx.store, uri);
      },
    },
    {
      id: 'file.close',
      icon: Icon.close,
      title: 'Close',
      category: 'File',
      slots: ['palette'],
      run: (_args: Record<string, unknown>, ctx: CommandContext) => {
        const uri = openUri(ctx);
        if (uri && getDocument(ctx.store, uri) && isDocumentDirty(ctx.store, uri)) {
          notify(ctx.app, { tone: 'warning', message: 'Unsaved changes - revert or save first.' });
          return;
        }
        ctx.store.set(EDITOR_URI, null);
        ctx.store.set(ACTIVE_PATH, {});
      },
    },

    // --- Edit --------------------------------------------------------------
    //
    // The editor takes ctrl+z itself while it has focus, because only it knows
    // where the caret should end up. These are the same step, reachable from
    // the palette and from anywhere else in the application - the buffer is
    // what remembers, so both arrive at the same place.
    {
      id: 'edit.undo',
      icon: Icon.undo,
      title: 'Undo',
      category: 'Edit',
      slots: ['palette'],
      when: '$/ui/editor/uri',
      run: (_args: Record<string, unknown>, ctx: CommandContext) => {
        const uri = openUri(ctx);
        if (!uri) return;
        if (!canUndoDocument(ctx.store, uri)) {
          notify(ctx.app, { message: 'Nothing to undo.' });
          return;
        }
        undoDocument(ctx.store, uri);
      },
    },
    {
      id: 'edit.redo',
      icon: Icon.redo,
      title: 'Redo',
      category: 'Edit',
      slots: ['palette'],
      when: '$/ui/editor/uri',
      run: (_args: Record<string, unknown>, ctx: CommandContext) => {
        const uri = openUri(ctx);
        if (!uri) return;
        if (!canRedoDocument(ctx.store, uri)) {
          notify(ctx.app, { message: 'Nothing to redo.' });
          return;
        }
        redoDocument(ctx.store, uri);
      },
    },

    // --- View --------------------------------------------------------------
    {
      id: 'view.theme',
      icon: Icon.theme,
      title: 'Theme',
      category: 'View',
      slots: ['palette'],
      // The command says what it needs and the palette asks. That is where a
      // submenu comes from here - not from a menu that hardcoded the list.
      args: [{
        name: 'id', type: 'string' as const, required: true, choices: themes,
        default: app.theme.id,
        // Wear it before you buy it. The theme applies as the highlight moves
        // and goes back if the asking is abandoned - the palette reports the
        // movement, and this remembers what to put back, because only this
        // knows what it changed.
        preview: (value: string | null) => {
          previousTheme ??= app.theme.id;
          if (value === null) {
            if (previousTheme) app.setTheme(previousTheme);
            previousTheme = null;
            return;
          }
          app.setTheme(value);
        },
      }],
      run: (args: Record<string, unknown>, ctx: CommandContext) => {
        const id = String(args.id ?? '');
        // Chosen, so there is nothing to put back.
        previousTheme = null;
        if (id) ctx.app.setTheme(id);
      },
    },
    {
      id: 'view.arrangement',
      icon: Icon.arrangement,
      title: 'Main Arrangement',
      category: 'View',
      slots: ['palette'],
      // The same shape as Theme: the command names what it needs and what the
      // answers are, and whatever is asking - a submenu, the palette - reads
      // that rather than keeping its own copy of the list.
      args: [{
        name: 'name', type: 'string' as const, required: true,
        choices: () => app.layouts.list().map((l) => l.name),
        default: app.surfaces.state('main').layout,
      }],
      run: (args: Record<string, unknown>, ctx: CommandContext) => {
        const name = String(args.name ?? '');
        // The registry is the authority on which names exist, so a name that
        // came out of it is a layout by construction.
        if (name) ctx.app.surfaces.setState('main', { layout: name as LayoutName });
      },
    },
    {
      id: 'file.edit',
      icon: Icon.edit,
      title: 'Toggle Edit Mode',
      category: 'File',
      slots: ['palette'],
      // View and edit are the same resource through two registrations, so this
      // asks the registry for the other one rather than swapping a component.
      run: (_args: Record<string, unknown>, ctx: CommandContext) => {
        const mode = ctx.store.get<string>('$/ui/editor/mode' as BindingPath) ?? 'view';
        const next = mode === 'edit' ? 'view' : 'edit';
        ctx.store.set('$/ui/editor/mode' as BindingPath, next);

        // The editor claims focus as it mounts - see `Editor` in app.tsx. It
        // is not chased from here, because at this moment it does not exist.
      },
    },
    {
      id: 'view.layout',
      icon: Icon.layout,
      title: 'Layout',
      category: 'View',
      slots: ['palette'],
      // Layout is what is *shown*, so this opens the parts you can hide -
      // plus, in its own section, how the main surface arranges what is in it.
      // The View menu lists this one entry instead of one line per toggle.
      run: (_args: Record<string, unknown>, ctx: CommandContext) => {
        ctx.app.layers.open({
          id: 'layout',
          layer: 'modal',
          scrim: true,
          trapFocus: true,
          dismissOnEscape: true,
          node: {
            component: 'CommandPalette',
            width: 62,
            placeholder: `Show, hide, arrange${app.theme.glyphs.ellipsis}`,
            // A function, not a snapshot: flipping a switch leaves the list
            // open, so every row has to redraw with what is now true.
            commands: () => layoutCommands(ctx.app),
            onClose: { handler: () => ctx.app.layers.close('layout') },
          },
        });
      },
    },
    {
      // One switch, told which surface to flip, rather than one command per
      // surface.
      //
      // Three near-identical commands were three rows that had to be kept out
      // of every list by hand, because the Layout palette already offers the
      // same switches - and they only covered the three surfaces this file
      // happened to know about, which is the opposite of letting a shell name
      // its own. A keybinding carries the surface as an argument, so binding a
      // key to `lateral1` needs nothing registered here.
      id: TOGGLE_COMMAND,
      icon: Icon.sidebar,
      title: 'Toggle Surface',
      category: 'View',
      // Never in a list. The Layout palette builds a row per surface from the
      // running shell, and this is what those rows and the keys both call.
      slots: [],
      args: [{ name: 'surface', type: 'string' }],
      run: (args: Record<string, unknown>, ctx: CommandContext) => {
        const surface = typeof args.surface === 'string' ? args.surface : null;
        if (surface) toggleSurface(ctx.app, surface as SurfaceName);
      },
    },

    // --- Help --------------------------------------------------------------
    {
      id: 'help.keys',
      icon: Icon.keys,
      title: 'Keyboard Shortcuts',
      category: 'Help',
      slots: ['palette'],
      run: (_args: Record<string, unknown>, ctx: CommandContext) => {
        const lines = ctx.app.commands
          .list({ slot: 'palette' })
          .map((c) => [ctx.app.keybindings.forCommand(c.id)[0], c.title] as const)
          .filter(([keys]) => keys !== undefined)
          .map(([keys, title]) => `${String(keys).padEnd(10)} ${title}`);

        ctx.app.layers.open({
          id: 'help.keys',
          layer: 'modal',
          scrim: true,
          trapFocus: true,
          dismissOnEscape: true,
          node: {
            component: 'Dialog',
            title: 'Keyboard Shortcuts',
            width: 46,
            children: { component: 'CodeViewer', content: lines.join('\n'), lineNumbers: false },
          },
        });
      },
    },
    {
      id: 'help.about',
      icon: Icon.about,
      title: 'About textide',
      category: 'Help',
      slots: ['palette'],
      run: (_args: Record<string, unknown>, ctx: CommandContext) => {
        notify(ctx.app, { title: 'textide', message: 'An IDE that runs in a terminal.', timeoutMs: 4000 });
      },
    },
  ];
}

/**
 * The palette's list, ordered.
 *
 * What is in front of you first, then what is true of the whole application.
 * The registry is a set, not a running order, so the order is decided here -
 * the palette renders what it is handed.
 */
export function paletteOrder(commands: CommandDefinition[]): CommandDefinition[] {
  const rank = (c: CommandDefinition): number => {
    const i = CATEGORIES.indexOf((c.category ?? '') as typeof CATEGORIES[number]);
    return i === -1 ? CATEGORIES.length : i;
  };
  return [...commands].sort((a, b) => rank(a) - rank(b) || a.title.localeCompare(b.title));
}
