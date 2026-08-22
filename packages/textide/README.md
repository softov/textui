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
  "tabWidth": 2
}
```

## What is here

| | |
|---|---|
| Chrome | Workbench shell, titlebar (workspace, file, unsaved marker), status bar |
| Explorer | The filesystem through the resource registry - lazy, sorted, filtered |
| Viewer | Whatever the registry says opens the selected kind |
| Editing | Selection, cut, copy, paste, indent, undo - `ctrl+c` is copy only while something is selected, so quit is never lost |
| Tabs | Every open file, `ctrl+pageup`/`ctrl+pagedown` between them, `ctrl+w` to close |
| Split | A second pane beside the first, on another file or the same one |
| Reload | `pnpm dev:watch`, then f5 or a save - the screen is rebuilt, the store is not |
| Files | New file, new folder, rename, delete-with-confirmation, as commands |
| Config | `.textide.json`, in the store like everything else |

## What is not, yet

- **Git.** Diff, stage, commit and branches arrive as a loadable extension
  rather than as part of this package.

## Why it is a package

textide is where the library gets used in anger. Everything it needs and
cannot find is a gap in TextUI, and the point of building it early is to find
those gaps by hitting them rather than by guessing.

`registerTextide(app, { workspace })` takes an application rather than making
one, so the whole editor can be mounted by a test today and hosted inside
another application later - the same way it will host git.
