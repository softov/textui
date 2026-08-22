import type {
  SurfaceName, CommandDefinition, CommandContext, TextUIApp, BindingPath, ThemeGlyphs,
} from '@textui/core';
import { FIND_QUERY, normalizeStroke, notify, prompt, setQuery, stepFind } from '@textui/core';
import {
  canRedoDocument, canUndoDocument, getDocument, isDocumentDirty, redoDocument,
  revertDocument, saveDocument, undoDocument,
} from '@textui/documents';
import { MARK_LINES } from '@textui/documents';
import { ACTIVE_PATH } from './filesystem.js';
import { iconsFor } from './icons.js';
import {
  EDITOR_LAYOUTS, EDITOR_URI, allTabs, closeTab, focusedIndex, layoutOf, otherGroup,
  paneScope, readGroups, selectTab, setLayout, splitEditor, stepTab, tabFromPath,
  tabPath, unsplit, type EditorLayout,
} from './tabs.js';

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

// The editor's own paths live with the tab model, because that is what keeps
// them in agreement. Re-exported so nothing that already imported them here
// has to learn where they moved.
export { EDITOR_URI } from './tabs.js';
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
      /*
       * What can be done to the thing in front of you.
       *
       * The registry already knows: `fs.rename` and `fs.delete` arrive with
       * the filesystem, `git.stage` and `git.diff` with git, and an extension
       * that registers an action for a kind appears here without this file
       * hearing about it. What was missing was a way to ask.
       *
       * Which thing: the file the keyboard is in, if it is in a pane, and the
       * row the tree is standing on otherwise - because "context" from a file
       * list means the row, and from an editor means what you are editing.
       */
      id: 'file.actions',
      icon: Icon.layout,
      title: 'Actions',
      category: 'File',
      slots: ['palette'],
      run: async (_args: Record<string, unknown>, ctx: CommandContext) => {
        const inPane = (ctx.store.get<string>('$/focus/scope' as BindingPath) ?? '')
          .startsWith('pane.');
        const uri = inPane
          ? ctx.store.get<string>(EDITOR_URI) ?? ctx.store.get<string>(`${ACTIVE_PATH}/uri`)
          : ctx.store.get<string>(`${ACTIVE_PATH}/uri`) ?? ctx.store.get<string>(EDITOR_URI);
        if (!uri) return;

        const resource = await ctx.app.resources.stat(uri);
        if (!resource) return;

        const actions = ctx.app.resources.actionsFor(resource.kind, 'context');
        if (actions.length === 0) {
          notify(ctx.app, { message: 'Nothing to do with this one.' });
          return;
        }

        const handle = ctx.app.layers.open({
          id: 'resource.actions',
          layer: 'floating',
          position: { kind: 'center' },
          trapFocus: true,
          dismissOnEscape: true,
          dismissOnOutsideClick: true,
          // A panel, not a bare menu: a floating layer paints over what is
          // beneath it only where something fills the cells, and a transparent
          // one reads as the tree with words on top of it.
          node: {
            component: 'box',
            bg: 'overlay',
            fg: 'text',
            border: ctx.app.theme.border,
            width: 36,
            ...(ctx.app.theme.border === 'none' ? { padding: { left: 1, right: 1 } } : {}),
            children: {
              component: 'ResourceActions',
              resource,
              slot: 'context',
              autoFocus: true,
              onRun: { handler: () => { handle.dispose(); } },
            },
          },
        });
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
        if (!uri) return;
        if (getDocument(ctx.store, uri) && isDocumentDirty(ctx.store, uri)) {
          notify(ctx.app, { tone: 'warning', message: 'Unsaved changes - revert or save first.' });
          return;
        }
        closeTab(ctx.store, uri);
        // Closing the last tab is the only way back to an empty pane, so the
        // titlebar has to stop naming a file nobody has open.
        if (ctx.store.get(EDITOR_URI) === null) ctx.store.set(ACTIVE_PATH, {});
      },
    },

    // --- Go: which of the open files ---------------------------------------
    {
      id: 'go.nextTab',
      icon: Icon.next,
      title: 'Next File',
      category: 'Go',
      slots: ['palette'],
      when: '$/ui/editor/uri',
      run: (_args: Record<string, unknown>, ctx: CommandContext) => { stepTab(ctx.store, 1); },
    },
    {
      id: 'go.previousTab',
      icon: Icon.previous,
      title: 'Previous File',
      category: 'Go',
      slots: ['palette'],
      when: '$/ui/editor/uri',
      run: (_args: Record<string, unknown>, ctx: CommandContext) => { stepTab(ctx.store, -1); },
    },
    {
      // One command, told which tab, rather than nine commands named after
      // positions. The nine keys carry the number, the same way one surface
      // switch carries which surface.
      id: 'go.tab',
      icon: Icon.go,
      title: 'Go To File By Number',
      category: 'Go',
      // Never in the palette: nine rows that differ only by a digit are nine
      // rows nobody reads. The shortcut list is where they belong.
      slots: [],
      args: [{ name: 'index', type: 'number' as const }],
      run: (args: Record<string, unknown>, ctx: CommandContext) => {
        selectTab(ctx.store, Number(args.index ?? 0));
      },
    },
    {
      // One list of what is open, rather than a strip you can only walk one
      // step at a time. With twenty files open the strip has stopped being a
      // way to find anything.
      id: 'go.file',
      icon: Icon.go,
      title: 'Open Files',
      category: 'Go',
      slots: ['palette'],
      when: '$/ui/editor/uri',
      args: [{
        name: 'path', type: 'string' as const, required: true,
        choices: () => allTabs(app.store).map((uri) => tabPath(app.store, uri)),
      }],
      run: (args: Record<string, unknown>, ctx: CommandContext) => {
        const uri = tabFromPath(ctx.store, String(args.path ?? ''));
        if (uri) ctx.store.set(EDITOR_URI, uri);
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
        if (name) ctx.app.surfaces.setState('main', { layout: name });
      },
    },
    {
      id: 'view.split',
      icon: Icon.split,
      title: 'Split Editor',
      category: 'View',
      slots: ['palette'],
      when: '$/ui/editor/uri',
      // A group is a list of URIs and which one is forward, so splitting
      // creates nothing and merging destroys nothing - which is why closing a
      // split cannot lose an edit, and why two panes on one file share a
      // buffer and a history.
      run: (_args: Record<string, unknown>, ctx: CommandContext) => {
        if (readGroups(ctx.store).length > 1) {
          unsplit(ctx.store);
          notify(ctx.app, { message: 'One group.' });
          return;
        }
        if (!splitEditor(ctx.store)) {
          notify(ctx.app, { tone: 'warning', message: 'Nothing open to split.' });
        }
      },
    },
    {
      id: 'view.editorLayout',
      icon: Icon.arrangement,
      title: 'Editor Layout',
      category: 'View',
      slots: ['palette'],
      // The same shape as Theme: the command names what it needs and what the
      // answers are, and whatever is asking reads that rather than keeping its
      // own copy of the list. Choosing an arrangement that needs two groups
      // makes the second one, so this is also how a split is opened.
      args: [{
        name: 'layout', type: 'string' as const, required: true,
        choices: [...EDITOR_LAYOUTS],
        default: layoutOf(app.store),
      }],
      run: (args: Record<string, unknown>, ctx: CommandContext) => {
        const layout = String(args.layout ?? '') as EditorLayout;
        if (EDITOR_LAYOUTS.includes(layout)) setLayout(ctx.store, layout);
      },
    },
    {
      id: 'go.otherGroup',
      icon: Icon.split,
      title: 'Other Group',
      category: 'Go',
      slots: ['palette'],
      when: '$/ui/editor/uri',
      /*
       * The keyboard goes too.
       *
       * Which group is focused and where focus actually is are one fact, and a
       * command that moved only the first half would leave the caret in the
       * pane you just left while the next file you opened landed in the other
       * one. The pane reports focus back the other way, so anything that moves
       * focus by any other means stays in step without this.
       */
      run: (_args: Record<string, unknown>, ctx: CommandContext) => {
        if (!otherGroup(ctx.store)) {
          notify(ctx.app, { message: 'Only one group. Split first.' });
          return;
        }
        const first = ctx.app.focus.order(paneScope(focusedIndex(ctx.store)))[0];
        if (first) ctx.app.focus.focus(first);
      },
    },
    {
      id: 'file.edit',
      icon: Icon.edit,
      title: 'Toggle Edit Mode',
      category: 'File',
      slots: ['palette'],
      // View and edit are two renderers registered for one kind, so this is
      // the panel command with a name from this application's vocabulary -
      // not a second implementation of it. Which panel it acts on is the one
      // the keyboard is in, which the panel itself publishes.
      /*
       * Which pane and which file, both said outright.
       *
       * A panel publishes what it is showing from an effect and takes the
       * active mark when it is focused, so a caller that opens a file and asks
       * to edit it in the same tick would be a frame ahead of both - and after
       * a split, the group the keyboard is in is this application's answer,
       * which is not the same question as which panel was last focused.
       */
      run: async (_args: Record<string, unknown>, ctx: CommandContext) => {
        const uri = ctx.store.get<string>(EDITOR_URI);
        return ctx.app.execute('panel.toggleEdit', {
          panel: paneScope(focusedIndex(ctx.store)),
          ...(uri ? { uri } : {}),
        });
      },
    },
    {
      /*
       * Find, in the file in front of you.
       *
       * The query goes in the store and whoever is showing the text picks it
       * up - the editor paints every match and moves its own caret, the status
       * bar counts them. Nothing here knows what a caret is.
       */
      id: 'find.inFile',
      icon: Icon.search,
      title: 'Find',
      category: 'Edit',
      slots: ['palette'],
      run: async (args: Record<string, unknown>, ctx: CommandContext) => {
        const given = typeof args.text === 'string' ? args.text : null;
        const text = given ?? await prompt(ctx.app.layers, {
          title: 'Find',
          message: 'What to look for',
          initialValue: ctx.store.get<string>(FIND_QUERY) ?? '',
        });
        if (text === null) return;
        setQuery(ctx.store, text);
        // Straight to the first one: a search that finds something and leaves
        // you where you were has not answered the question you asked.
        if (text !== '') stepFind(ctx.store, 1);
      },
    },
    {
      id: 'find.next',
      icon: Icon.next,
      title: 'Find Next',
      category: 'Edit',
      slots: ['palette'],
      run: (_args: Record<string, unknown>, ctx: CommandContext) => {
        stepFind(ctx.store, 1);
      },
    },
    {
      id: 'find.previous',
      icon: Icon.previous,
      title: 'Find Previous',
      category: 'Edit',
      slots: ['palette'],
      run: (_args: Record<string, unknown>, ctx: CommandContext) => {
        stepFind(ctx.store, -1);
      },
    },
    {
      id: 'find.clear',
      title: 'Clear Search',
      category: 'Edit',
      slots: ['palette'],
      run: (_args: Record<string, unknown>, ctx: CommandContext) => {
        setQuery(ctx.store, '');
      },
    },
    {
      /*
       * The changed lines, washed as well as marked.
       *
       * A toggle rather than a setting buried in a file, because it is the
       * kind of thing you want on while you are working through a diff and off
       * while you are reading.
       */
      id: 'view.markLines',
      icon: Icon.edit,
      title: 'Highlight Changed Lines',
      category: 'View',
      slots: ['palette'],
      keepOpen: true,
      run: (_args: Record<string, unknown>, ctx: CommandContext) => {
        const on = ctx.store.get<boolean>(MARK_LINES as BindingPath) === true;
        ctx.store.set(MARK_LINES as BindingPath, !on);
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
      // The footer has room for five keys and there are thirty, so this is
      // where the other twenty-five are. Built from the *keybindings* rather
      // than from the palette: a key that is bound to a command nobody put in
      // a list is exactly the key nobody can otherwise find.
      run: (_args: Record<string, unknown>, ctx: CommandContext) => {
        ctx.app.layers.open({
          id: 'help.keys',
          layer: 'modal',
          scrim: true,
          trapFocus: true,
          dismissOnEscape: true,
          node: {
            component: 'Dialog',
            title: 'Keyboard Shortcuts',
            width: 56,
            children: {
              component: 'CodeViewer',
              content: shortcutSheet(ctx.app),
              lineNumbers: false,
              height: 16,
            },
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
 * Every bound key, as a page.
 *
 * Grouped by the category of the command each key runs, because "what can I do
 * to the file in front of me" and "how do I move around" are two questions and
 * a flat alphabetical list answers neither.
 *
 * A command bound to more than two keys is collapsed to its ends - `alt+1` to
 * `alt+9` is one row saying one thing, not nine rows saying it nine times. The
 * command is one command, and the digit is its argument; the sheet says so the
 * same way the registration does.
 */
export function shortcutSheet(app: TextUIApp): string {
  const groups = new Map<string, Map<string, string[]>>();

  for (const binding of app.keybindings.list()) {
    const command = app.commands.get(binding.commandId);
    const category = command?.category ?? 'Other';
    const title = command?.title ?? binding.commandId;
    const byTitle = groups.get(category) ?? new Map<string, string[]>();
    // Normalised, so the sheet says the stroke that actually arrives.
    // `alt+shift+?` is registered as it is meant and filed as `alt+?`, because
    // a terminal reports shift through the character it produced rather than
    // beside it - and the sheet has to agree with the footer.
    byTitle.set(title, [...(byTitle.get(title) ?? []), normalizeStroke(binding.keys)]);
    groups.set(category, byTitle);
  }

  const order = [...CATEGORIES, 'Other'];
  const rank = (name: string): number => {
    const i = order.indexOf(name as typeof CATEGORIES[number]);
    return i === -1 ? order.length : i;
  };

  /*
   * A run collapses to its ends; a list of aliases does not.
   *
   * `alt+1` to `alt+9` is one thing said once. `f1`, `alt+?` and `alt+/` are
   * three different ways to press the same command, and printing them as
   * "f1 .. alt+/" would name two of them and invent a range between keys that
   * have no order. So a run has to actually be one: the same prefix, and
   * numbers that count.
   */
  const runs = (keys: string[]): boolean => {
    if (keys.length < 3) return false;
    const parts = keys.map((k) => /^(.*?)(\d+)$/.exec(k));
    if (parts.some((m) => m === null)) return false;
    const prefix = (parts[0] as RegExpExecArray)[1];
    return parts.every((m, i) =>
      (m as RegExpExecArray)[1] === prefix
      && Number((m as RegExpExecArray)[2]) === Number((parts[0] as RegExpExecArray)[2]) + i);
  };

  /*
   * And a list of aliases stops when the column is full.
   *
   * One command with four ways to reach it makes the key column as wide as
   * that one row, and every label in the sheet loses the columns it took -
   * "Command Palette" became "Command Pa". The keys are in the order they were
   * registered, which is the order of how reliably they arrive, so what falls
   * off the end is the one worth having least.
   */
  const BUDGET = 24;
  const fits = (keys: string[]): string[] => {
    const out: string[] = [];
    for (const k of keys) {
      const next = [...out, k].join(', ');
      if (out.length > 0 && next.length > BUDGET) break;
      out.push(k);
    }
    return out;
  };

  const shown = (keys: string[]): string => (runs(keys)
    ? `${keys[0] as string} .. ${keys[keys.length - 1] as string}`
    : fits(keys).join(', '));

  // The column is as wide as its widest row, measured rather than guessed: a
  // fixed width is a column that lines up until the day something longer than
  // it is bound, and then lines up nowhere.
  const column = Math.max(...[...groups.values()]
    .flatMap((byTitle) => [...byTitle.values()].map((keys) => shown(keys).length)));

  const out: string[] = [];
  for (const category of [...groups.keys()].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))) {
    if (out.length > 0) out.push('');
    out.push(category);
    const byTitle = groups.get(category) as Map<string, string[]>;
    for (const title of [...byTitle.keys()].sort((a, b) => a.localeCompare(b))) {
      out.push(`  ${shown(byTitle.get(title) as string[]).padEnd(column)}  ${title}`);
    }
  }
  return out.join('\n');
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
