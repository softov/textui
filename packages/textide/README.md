# textide

An IDE that runs in a terminal.

```bash
pnpm textide              # open the current directory
pnpm textide ../some-dir  # open another one
pnpm textide --readonly   # refuse every write
pnpm textide --static     # one frame to stdout, for a pipe or a screenshot
```

`--help` lists the rest.

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

- **The editor.** `CodeViewer` is read-only; a real `CodeEditor` - cursor,
  selection, undo - does not exist yet. Nothing here can change a file's
  contents.
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
