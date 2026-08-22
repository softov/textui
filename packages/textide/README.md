# textide

An IDE that runs in a terminal.

```bash
pnpm textide              # open the current directory
pnpm textide ../some-dir  # open another one
pnpm textide --readonly   # refuse every write
pnpm textide --static     # one frame to stdout, for a pipe or a screenshot
```

`--help` lists the rest.

## Seeing what it drew

A terminal application has nowhere to print a diagnostic: the screen is the output, and the next redraw erases whatever was wrong. So there are three ways to get the evidence out of the process.

**f12 writes the frame that is on screen.** Not the one `--static` renders - the real one, with the file you have open, where you scrolled to and what has focus. Two files: `textide-001.ans` keeps the colour and replays with `cat`, and `textide-001.txt` beside it is the same frame in plain text, which is the one a diff can read and an issue can carry. `--shots <dir>` says where they go.

**`--unicode` and `--colors` show you a terminal you are not sitting at.** Detection is right almost always, and the times it is not are the times nobody is watching.

```bash
pnpm textide --unicode ascii    # a console with no dingbats
pnpm textide --unicode bmp      # blocks and box drawing, nothing exotic
pnpm textide --colors 4         # sixteen colours
pnpm textide --colors 0         # none
```

Every glyph has three tiers - the theme's in [`glyphs.ts`](../core/src/themes/glyphs.ts), textide's own in [`icons.ts`](src/icons.ts) - and a test asserts the ASCII tier is actually ASCII, because a fallback holding one stray `⌸` fails on exactly the terminal it exists for.

**`--log-file` and `--log-unix` send a running commentary somewhere else.** What has focus, what the chrome did, every command that ran. `examples/logtail.mjs` listens on a socket.

## Keys that are chords on purpose

Switching file is `alt+←`, `alt+→` and `alt+1`…`alt+9` rather than something
you reach by tabbing to the strip. Both of the alternatives cost you the
keyboard: tab leaves the strip for the menu bar, and an arrow *inside* the
strip changes the tab but leaves focus in the strip rather than in what you
were doing.

Moving the highlight in the explorer opens nothing: **enter opens**. It used
to open whatever the highlight landed on, so rolling past a folder of fifteen
files opened fifteen tabs and read fifteen files off the disk. Moving through
a tree is how you look *for* something.

A chord costs nothing, because a control only takes a key that is not chorded.
The caret takes a plain arrow and leaves `alt+←` alone, so one pair of keys
means "a character" inside a file and "a file" across them, and whatever had
focus still has it afterwards. `chorded()` in the runtime is that rule written
once, and every navigating control asks it.

`alt+9` with three files open does nothing, deliberately. A key that always
does *something* teaches you nothing about how many files you have open, and
`alt+9` quietly meaning `alt+3` is worse than `alt+9` meaning nothing.

The footer has room for five keys and there are thirty, so **`f1` opens the
sheet** (`alt+?` and `alt+/` do too, when the terminal agrees about which of
those a held shift produces - `f1` is the one that always arrives). It is built from the keybindings rather than from the palette,
because a key bound to a command nobody put in a list is exactly the key
nobody can otherwise find - and a command bound to nine keys is one row saying
`alt+1 .. alt+9`, not nine rows saying it nine times.

## Reloading while it runs

```bash
pnpm dev:watch      # rebuild on save, and swap it into the running editor
```

A save rebuilds and the editor re-registers itself; f5 does the same on
demand. **Nothing in the store is touched**, which is the whole point: the
files you have open, the buffer you have not saved, where you had scrolled to
and which pane had focus all live there, and navigating back to them is most
of what quit-and-run actually costs.

What that takes is ownership. `registerTextide` returns one bag, the entry
point keeps it, and a reload disposes exactly that bag before calling the new
module's `registerTextide` - dispose too little and there are two `file.save`
commands and two viewers claiming `file.markdown`; dispose too much and a host
application loses its own registrations. Every layer is closed on the way
through, because an open palette is a node built by the module that is about
to stop existing.

A build that fails never reaches the swap. The running editor keeps working
and the status bar says `reload failed` - a toast would land on the frame you
are looking at, which is the frame the reload exists to preserve.

Only textide's own sources reload. The runtime is bundled to its own file that
both the host and the reloaded module import by URL, so they hold the *same*
`@textui/core` - a second copy would build components whose hooks read a
`currentInstance` the first copy's renderer never sets, and every one of them
would throw on its first render. The price is that a change under
`packages/core` still needs the process restarted.

## The workspace

A directory is a workspace. `.textide.json` in its root configures it, and a
workspace without one uses the defaults - an editor that will not open a
directory until it is configured is an editor nobody opens.

```json
{
  "name": "My Project",
  "theme": "workbench",
  "sidebarCollapsed": false,
  "hidden": false,
  "exclude": ["node_modules", ".git", "dist"],
  "readonly": false,
  "tabWidth": 2,
  "extensions": ["@textui/textide-git"]
}
```

## Extensions

An extension is a module that exports `activate(app, context)` and returns a
`Disposable`. That is the whole contract, and it is the same one
`registerTextide` follows: the registries are already late-binding, so
registering *is* the activation - there is no manifest, no activation event and
no lifecycle to learn.

```js
export function activate(app, context) {
  return app.commands.register({
    id: 'mine.hello',
    title: `Hello from ${context.root}`,
    slots: ['palette'],
    run: () => {},
  });
}
```

`extensions` in `.textide.json` names them: a path relative to the workspace,
or a package resolved from the workspace's own `node_modules` - which is where
a project's extensions belong, rather than beside the editor. One that fails to
load is reported and skipped; an editor that will not open because a plugin is
missing has made the plugin mandatory.

[`@textui/textide-git`](../textide-git) is the one that exists, and it is the
proof the boundary is in the right place: git arrives as an adapter, some
commands, a component and a mount, and unloading it leaves nothing behind.

## What is here

| | |
|---|---|
| Chrome | Workbench shell, titlebar (workspace, file, unsaved marker), status bar |
| Explorer | The filesystem through the resource registry - lazy, sorted, filtered |
| Viewer | Whatever the registry says opens the selected kind |
| Editing | Selection, cut, copy, paste, indent, undo - `ctrl+c` is copy only while something is selected, so quit is never lost |
| Tabs | Every open file. `alt+←`/`alt+→` between them, `alt+1`…`alt+9` straight to one, `ctrl+w` to close |
| Keys | `f1` opens the sheet - the footer holds five, and there are thirty |
| Split | A second pane beside the first, on another file or the same one |
| Reload | `pnpm dev:watch`, then f5 or a save - the screen is rebuilt, the store is not |
| Extensions | Whatever `.textide.json` lists, loaded at boot |
| Files | New file, new folder, rename, delete-with-confirmation, as commands |
| Config | `.textide.json`, in the store like everything else |

## Why it is a package

textide is where the library gets used in anger. Everything it needs and
cannot find is a gap in TextUI, and the point of building it early is to find
those gaps by hitting them rather than by guessing.

`registerTextide(app, { workspace })` takes an application rather than making
one, so the whole editor can be mounted by a test today and hosted inside
another application later - the same way it will host git.
