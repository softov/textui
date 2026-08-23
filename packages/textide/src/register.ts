import type { Disposable, EventPath, TextUIApp } from '@textui/core';
import { createBag, notify, registerBuiltins } from '@textui/core';
import { jsonAdapter, registerDocuments } from '@textui/documents';
import { filesystemAdapter } from './filesystem.js';
import { seedWorkspace, type Workspace } from './workspace.js';
import { rememberSettings, seedSettings } from './settings.js';
import { Editor, Explorer } from './app.js';
import {
  EXTENSION_KINDS, EXTENSION_VIEWERS, ExtensionView, ExtensionsPanel,
  createExtensionProvider, extensionUri,
} from './panels/extensions.js';
import { EDITOR_URI } from './tabs.js';
import { TitleBar } from './chrome/titlebar.js';
import { StatusLine } from './chrome/statusbar.js';
import { MenuBar } from './chrome/menubar.js';
import { SearchResults } from './chrome/results.js';
import { textideCommands, paletteOrder, TOGGLE_COMMAND } from './commands.js';
import { iconsFor } from './icons.js';
import { takeScreenshot } from './screenshot.js';

export interface RegisterOptions {
  workspace: Workspace;
  /** Also register the shipped catalog. On unless the host already did it. */
  builtins?: boolean;
  /** Where `view.screenshot` writes. Defaults to the working directory. */
  shots?: string;
  /**
   * Write settings back to `.textide.json` as they change. On by default.
   *
   * Off for a test, and for a host embedding textide in something that owns
   * its own configuration.
   */
  remember?: boolean;
}

/**
 * Everything textide puts into an application, in one call.
 *
 * It takes an app rather than making one so that the whole editor can be
 * mounted inside something else - a test harness now, another application
 * later. An entry point that owns its own `createApp` can only ever be run.
 */
export function registerTextide(app: TextUIApp, options: RegisterOptions): Disposable {
  const { workspace } = options;
  const bag = createBag();

  if (options.builtins !== false) bag.add(registerBuiltins(app));
  bag.add(registerDocuments(app));

  bag.add(app.registerAdapter(filesystemAdapter({
    readonly: workspace.readonly === true,
    hidden: workspace.hidden === true,
    ...(workspace.exclude ? { exclude: workspace.exclude } : {}),
    icons: iconsFor(app.capabilities.unicode),
  })));
  bag.add(app.registerAdapter(jsonAdapter()));
  // An extension is a thing you open, so it is a resource and it opens through
  // the registry like anything else - which is what makes the detail a tab
  // with room for its actions rather than a caption under a narrow list.
  bag.add(app.registerAdapter({
    id: 'textide.extensions',
    title: 'Extensions',
    kinds: EXTENSION_KINDS,
    viewers: EXTENSION_VIEWERS,
    providers: [createExtensionProvider()],
    commands: [{
      id: 'extensions.show',
      title: 'Show Extension',
      category: 'Extensions',
      slots: ['palette'],
      args: [{ name: 'id', type: 'string', required: true }],
      // The editor's own tab strip, not a second mount on `main`. Setting the
      // open URI is what git does for `git:log/<path>`, and it is why an
      // extension arrives as a tab beside your files rather than as a pane
      // competing with them for the region.
      run: (args, ctx) => {
        const id = String(args.id ?? '');
        if (id) ctx.store.set(EDITOR_URI, extensionUri(id));
      },
    }],
  }));

  seedWorkspace(app, workspace);
  // What the workspace remembered, before the first frame - and a subscription
  // that writes the next change back. A preference you have to set again every
  // morning is not a preference.
  seedSettings(app, workspace);
  if (options.remember !== false) bag.add(rememberSettings(app, workspace));

  const Icon = iconsFor(app.capabilities.unicode);

  for (const command of textideCommands(app)) bag.add(app.commands.register(command));

  // A terminal application cannot show you what it looked like when it went
  // wrong, so this is how it tells you: the frame that is on screen, written
  // out with its colours. `notify` after, never before - a toast in the
  // picture is a picture of the toast.
  bag.add(app.commands.register({
    id: 'view.screenshot',
    title: 'Screenshot',
    category: 'View',
    icon: Icon.camera,
    description: 'Write the current frame to a file',
    slots: ['palette'],
    run: async () => {
      try {
        const shot = await takeScreenshot(app, options.shots ? { dir: options.shots } : {});
        app.events.emit('@/app/screenshot' as EventPath, {
          ansi: shot.ansi, text: shot.text, width: shot.width, height: shot.height,
        });
        notify(app, { tone: 'success', message: `Saved ${shot.ansi}` });
      } catch (error) {
        notify(app, { tone: 'danger', message: `Screenshot failed: ${String(error)}` });
      }
    },
  }));
  bag.add(app.keybindings.register({ keys: 'f12', commandId: 'view.screenshot' }));

  // The palette is a command like everything else, so the menu and a
  // keybinding reach the same one.
  bag.add(app.commands.register({
    id: 'app.palette',
    title: 'Command Palette',
    category: 'View',
    icon: Icon.palette,
    // Not in its own list. Offering "Command Palette" inside the command
    // palette is an entry whose only effect is to redraw what you are already
    // looking at. The menu and the keybinding reach it by id regardless.
    slots: [],
    args: [
      { name: 'query', type: 'string' },
      // Which question to ask. A caller that already knows - a menu item for
      // Theme - opens the palette on that command's choices rather than on the
      // whole list with a word typed into the search box.
      { name: 'at', type: 'string' },
    ],
    run: (args) => {
      app.layers.open({
        id: 'palette',
        layer: 'modal',
        scrim: true,
        trapFocus: true,
        dismissOnEscape: true,
        node: {
          component: 'CommandPalette',
          width: 62,
          // What is in front of you first, then the application's own.
          commands: paletteOrder(app.commands.list({ slot: 'palette', enabledOnly: true })),
          placeholder: typeof args.query === 'string' && args.query ? String(args.query) : undefined,
          openAt: typeof args.at === 'string' && args.at ? String(args.at) : undefined,
          onClose: { handler: () => app.layers.close('palette') },
        },
      });
    },
  }));

  // A key bound to a surface carries which surface, because there is one
  // switch and not one per surface. The Layout palette reads the argument back
  // to show the key beside the row.
  bag.add(app.keybindings.register({
    keys: 'ctrl+b', commandId: TOGGLE_COMMAND, args: { surface: 'sidebar' },
    title: 'Show or Hide the Sidebar',
  }));

  /*
   * And the same key with shift for *which* panel, rather than whether.
   *
   * It opens the palette already drilled into `view.sidebarPanel` instead of
   * being a second command: the question "which panel" is one the palette
   * knows how to ask, off the surface registry, so a panel an extension
   * mounted is in the list by having been mounted. A key that reached past it
   * would be a second answer to a question already answered.
   *
   * `ctrl+shift+<letter>` only arrives where the session negotiated a keyboard
   * protocol - a plain terminal sends one control byte for both, and this key
   * toggles the sidebar there instead. That is why the command keeps its place
   * in the palette and the View menu, which is the route that always works.
   */
  bag.add(app.keybindings.register({
    keys: 'ctrl+shift+b', commandId: 'app.palette', args: { at: 'view.sidebarPanel' },
    title: 'Choose a Sidebar Panel',
  }));

  // Keybindings are registered here, not in `main`, because a host that
  // embeds textide gets the editor and its keys or neither - an entry point
  // that keeps them to itself hands over a screen nobody can drive.
  for (const [keys, commandId] of [
    ['ctrl+p', 'app.palette'],
    ['ctrl+k', 'app.palette'],
    ['ctrl+s', 'file.save'],
    // Only where a keyboard protocol distinguishes it from `ctrl+s`; the
    // File menu is the route that always works.
    ['ctrl+shift+s', 'file.saveAs'],
    ['ctrl+o', 'file.open'],
    ['ctrl+w', 'file.close'],
    /*
     * Find, and step through what it found.
     *
     * `f3` is the key every editor has had for thirty years and no terminal
     * argues about; `ctrl+f` is the one people reach for first. Escape out of
     * the editor first if you want the arrows back - the search does not take
     * them.
     */
    ['ctrl+f', 'find.inFile'],
    ['ctrl+shift+f', 'find.inWorkspace'],
    ['f3', 'find.next'],
    ['shift+f3', 'find.previous'],
    /*
     * What can be done to this file. Two keys because neither is universal:
     * the Menu key on a PC keyboard sends nothing a terminal agrees on,
     * `shift+f10` is what stands in for it, and `alt+enter` is the chord
     * everything else uses for "tell me about this one".
     */
    ['shift+f10', 'file.actions'],
    ['alt+enter', 'file.actions'],
    ['ctrl+n', 'fs.newFile'],
    // The editor takes these while it has focus, because only it can put the
    // caret back. These are the same step from anywhere else.
    /*
     * And a second way to save, for a terminal that never passes the first.
     *
     * `ctrl+s` is XOFF to a terminal and "save the file" to the editor hosting
     * one - VS Code keeps it for itself by default, so the key arrives
     * nowhere. Nothing here can win that argument, so there is another key.
     */
    ['alt+s', 'file.save'],
    ['ctrl+z', 'edit.undo'],
    ['ctrl+y', 'edit.redo'],
    /*
     * Cut, copy and paste are the editor's own keys while it has focus - it
     * is the only thing that knows where the caret should end up - and these
     * are the same act from anywhere else, which is what the menu rows and
     * the palette entries run.
     */
    ['ctrl+x', 'edit.cut'],
    ['ctrl+v', 'edit.paste'],
    ['ctrl+a', 'edit.selectAll'],
    ['ctrl+e', 'file.edit'],
    /*
     * Walking the strip, without going to it.
     *
     * These are chords on purpose. A control only takes a key that is not
     * chorded - the caret takes a plain arrow and leaves `alt+left` alone -
     * so one pair of keys means "a character" inside a file and "a file"
     * across them, and switching file never costs the keyboard: whatever had
     * focus still has it afterwards.
     */
    ['alt+left', 'go.previousTab'],
    ['alt+right', 'go.nextTab'],
    ['ctrl+pageup', 'go.previousTab'],
    ['ctrl+pagedown', 'go.nextTab'],
    /*
     * And the pair everybody tries first - where the terminal allows it.
     *
     * A plain terminal sends the same byte for `tab` and `ctrl+tab`, so this
     * binding is unreachable unless the session negotiated a keyboard protocol
     * that disambiguates them. It costs nothing where it does not arrive, and
     * the two pairs above are the ones that always work.
     */
    ['ctrl+tab', 'go.nextTab'],
    ['ctrl+shift+tab', 'go.previousTab'],
    /*
     * The shortcut list, which is where every key that is not on the footer
     * has to be findable - so it cannot itself be hard to press.
     *
     * `f1` is the one that always arrives. The others are the same physical
     * key - `?` *is* shift and `/` - and terminals disagree about what to
     * report: a plain one sends `ESC /` or `ESC ?` and says nothing about
     * shift, and one speaking a keyboard protocol sends the unshifted `/`
     * with a shift bit beside it. Those are three strokes, `alt+/`, `alt+?`
     * and `alt+shift+/`, and all three are bound.
     *
     * In that order, because the shortcut sheet's key column has a budget and
     * drops from the end: registration order is how reliably each arrives, so
     * what falls off is the one worth having least. `f1` is what the footer
     * offers - a documented key that does not work is worse than no key.
     */
    // The other half of a split. `f6` is what a window manager and half the
    // editors in existence use for "the next pane", and it is not a chord over
    // a key that means something else.
    ['f6', 'go.otherGroup'],
    ['f1', 'help.keys'],
    ['alt+/', 'help.keys'],
    ['alt+?', 'help.keys'],
    ['alt+shift+/', 'help.keys'],
    // F10 enters the bar; alt+letter opens one menu outright. Both exist
    // because the first is discoverable and the second is fast.
    ['f10', 'menu.focus'],
    ['alt+f', 'menu.file'],
    ['alt+e', 'menu.edit'],
    ['alt+v', 'menu.view'],
    ['alt+h', 'menu.help'],
  ] as const) {
    bag.add(app.keybindings.register({ keys, commandId }));
  }

  // One key per position. The command is one command and the digit is its
  // argument, so nine keys cost one row in the shortcut list rather than nine.
  for (let index = 1; index <= 9; index++) {
    bag.add(app.keybindings.register({
      keys: `alt+${index}`, commandId: 'go.tab', args: { index },
    }));
  }

  bag.add(app.components.registerMany([
    {
      component: 'SearchResults',
      category: 'chrome',
      renderer: { kind: 'function', render: SearchResults },
      description: 'What the last workspace search found.',
    },
    { component: 'MenuBar', category: 'chrome', renderer: { kind: 'function', render: MenuBar }, description: 'File, View and Help, all commands.' },
    { component: 'TitleBar', category: 'chrome', renderer: { kind: 'function', render: TitleBar }, description: 'Workspace, open file and unsaved marker.' },
    { component: 'StatusLine', category: 'chrome', renderer: { kind: 'function', render: StatusLine }, description: 'Where you are and what is true right now.' },
    { component: 'Explorer', category: 'chrome', renderer: { kind: 'function', render: Explorer }, description: 'The workspace tree.' },
    { component: 'ExtensionsPanel', category: 'chrome', renderer: { kind: 'function', render: ExtensionsPanel }, description: 'What is loaded, and how many are wrong.' },
    { component: 'ExtensionView', category: 'chrome', renderer: { kind: 'function', render: ExtensionView }, description: 'One extension: what it is, what it brought, what can be done to it.' },
    { component: 'Editor', category: 'chrome', renderer: { kind: 'function', render: Editor }, description: 'The open files, the pane or panes, and the key hints.' },
  ]));

  // One component per surface. The shell decides where each region sits, so
  // adding a panel later is a mount rather than a change to a layout here.
  //
  // The mounts go in the bag with everything else. A registration that leaves
  // its mounts behind is a registration that cannot be undone: disposing it
  // unregisters the components and leaves four surfaces pointing at names
  // nothing answers to, which is what a hot reload would do twice a minute.
  bag.add(app.open({ surface: 'header', key: 'titlebar', target: { component: 'TitleBar' } }));
  // Named, because the sidebar shows one panel at a time and the heading is
  // how you know which. It had no title while it was the only thing there.
  bag.add(app.open({
    surface: 'sidebar',
    key: 'explorer',
    target: { component: 'Explorer' },
    display: { title: 'Explorer' },
  }));
  // The second sidebar panel, and the reason the sidebar shows one at a time.
  // Mounted at boot rather than by the loader: the panel that says nothing
  // loaded has to exist before anything has tried to load.
  bag.add(app.open({
    surface: 'sidebar',
    key: 'extensions',
    target: { component: 'ExtensionsPanel' },
    display: { title: 'Extensions' },
  }));
  bag.add(app.open({ surface: 'main', key: 'editor', target: { component: 'Editor' } }));
  bag.add(app.open({ surface: 'status', key: 'status', target: { component: 'StatusLine' } }));
  // The bottom panel, hidden until a search puts something in it.
  //
  // It was mounted visible and nothing ever hid it, so an empty results panel
  // took seven rows of a twenty-two row terminal and drew nothing in them -
  // a third of the screen, reserved for a component whose empty state is
  // `return null`. `find.inWorkspace` shows it; `find.clear` puts it away.
  bag.add(app.open({
    surface: 'panel',
    key: 'results',
    target: { component: 'SearchResults' },
    display: { title: 'Search' },
  }));
  app.surfaces.setState('panel', { visible: false });
  return bag;
}
