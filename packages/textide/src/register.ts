import type { Disposable, EventPath, TextUIApp } from '@textui/core';
import { createBag, notify, registerBuiltins } from '@textui/core';
import { jsonAdapter, registerDocuments } from '@textui/documents';
import { filesystemAdapter } from './filesystem.js';
import { seedWorkspace, type Workspace } from './workspace.js';
import { Editor, Explorer } from './app.js';
import { TitleBar } from './chrome/titlebar.js';
import { StatusLine } from './chrome/statusbar.js';
import { MenuBar } from './chrome/menubar.js';
import { textideCommands, paletteOrder, TOGGLE_COMMAND } from './commands.js';
import { iconsFor } from './icons.js';
import { takeScreenshot } from './screenshot.js';

export interface RegisterOptions {
  workspace: Workspace;
  /** Also register the shipped catalog. On unless the host already did it. */
  builtins?: boolean;
  /** Where `view.screenshot` writes. Defaults to the working directory. */
  shots?: string;
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
  })));
  bag.add(app.registerAdapter(jsonAdapter()));

  seedWorkspace(app, workspace);

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
  }));

  // Keybindings are registered here, not in `main`, because a host that
  // embeds textide gets the editor and its keys or neither - an entry point
  // that keeps them to itself hands over a screen nobody can drive.
  for (const [keys, commandId] of [
    ['ctrl+p', 'app.palette'],
    ['ctrl+k', 'app.palette'],
    ['ctrl+s', 'file.save'],
    ['ctrl+w', 'file.close'],
    ['ctrl+n', 'fs.newFile'],
    ['ctrl+e', 'file.edit'],
    // F10 enters the bar; alt+letter opens one menu outright. Both exist
    // because the first is discoverable and the second is fast.
    ['f10', 'menu.focus'],
    ['alt+f', 'menu.file'],
    ['alt+v', 'menu.view'],
    ['alt+h', 'menu.help'],
  ] as const) {
    bag.add(app.keybindings.register({ keys, commandId }));
  }

  bag.add(app.components.registerMany([
    { component: 'MenuBar', category: 'chrome', renderer: { kind: 'function', render: MenuBar }, description: 'File, View and Help, all commands.' },
    { component: 'TitleBar', category: 'chrome', renderer: { kind: 'function', render: TitleBar }, description: 'Workspace, open file and unsaved marker.' },
    { component: 'StatusLine', category: 'chrome', renderer: { kind: 'function', render: StatusLine }, description: 'Where you are and what is true right now.' },
    { component: 'Explorer', category: 'chrome', renderer: { kind: 'function', render: Explorer }, description: 'The workspace tree.' },
    { component: 'Editor', category: 'chrome', renderer: { kind: 'function', render: Editor }, description: 'The open document, and the key hints.' },
  ]));

  // One component per surface. The shell decides where each region sits, so
  // adding a panel later is a mount rather than a change to a layout here.
  app.open({ surface: 'header', key: 'titlebar', target: { component: 'TitleBar' } });
  app.open({ surface: 'sidebar', key: 'explorer', target: { component: 'Explorer' } });
  app.open({ surface: 'main', key: 'editor', target: { component: 'Editor' } });
  app.open({ surface: 'status', key: 'status', target: { component: 'StatusLine' } });
  return bag;
}
