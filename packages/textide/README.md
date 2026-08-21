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
| Files | New file, new folder, rename, delete-with-confirmation, as commands |
| Config | `.textide.json`, in the store like everything else |

## What is not, yet

- **Selection and the clipboard.** `CodeEditor` has a cursor, edits, saves and
  undo. It has no selection, so there is nothing to cut, copy or indent yet.
- **Hot reload.** `pnpm dev` bundles from the workspace sources, so a change to
  the runtime is live on the next run with no build in between - but a running
  editor does not pick it up. The shape it would take is written down in
  [decisions](../../docs/decisions.md): a full remount that keeps the store,
  not a clever partial one.
- **Tabs and splits.** One explorer, one view. [`app.tsx`](src/app.tsx) is the
  only place that knows that, which is the point of keeping the tree and the
  viewer as separate components.
- **Git.** Diff, stage, commit and branches arrive as a loadable extension
  rather than as part of this package.

## Why it is a package

textide is where the library gets used in anger. Everything it needs and
cannot find is a gap in TextUI, and the point of building it early is to find
those gaps by hitting them rather than by guessing.

`registerTextide(app, { workspace })` takes an application rather than making
one, so the whole editor can be mounted by a test today and hosted inside
another application later - the same way it will host git.
