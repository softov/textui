# scratch

Paste a snippet here rather than into an untitled buffer.

An unsaved file belongs to no folder, so it belongs to no `tsconfig.json`, so
the editor falls back to its implicit project - where `jsxImportSource`
defaults to `react` and every JSX tag reports:

```
This JSX tag requires the module path 'react/jsx-runtime' to exist
```

Nothing is wrong with the code. It is being compiled as though it were React.

A file saved in here gets this folder's `tsconfig.json`, which points
`jsxImportSource` at `textui`. Run one with `node file.ts` or `bun file.tsx`.

Contents are gitignored; the three config files are not.
