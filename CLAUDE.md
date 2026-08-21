# CLAUDE.md

TextUI is a terminal UI runtime. A screen is data - a graph of component nodes resolved through late-binding registries - and JSX is a way of writing that data, not a different thing from it.

Read [`README.md`](README.md), then [`docs/`](docs/index.md): the architecture, the vocabulary, and the rules a consumer has to follow.

The docs are a Jekyll site published to GitHub Pages. There is no Ruby on this
machine and there is not going to be - `scripts/docs-serve.sh` runs it in a
container, `scripts/docs-preview.py` serves an already-built `_site` with no
container at all, and `node scripts/check-docs.mjs` checks the nav tree without
either. A plain `python -m http.server` over `docs/_site` will 404 on every
file, because the site is built with `baseurl: /textui` and nothing is mounted
there.
Two rules the build enforces: a page's `parent:` must match another page's
`title:` exactly, and `render_with_liquid: false` is what stops Jekyll reading
`{{` in a JSX prop as a Liquid variable.

## Commands

```bash
pnpm build          # every package (tsc, project references)
pnpm typecheck      # every workspace, including components/ and playground/
pnpm test           # every suite
pnpm dev <id>       # a playground; `--list` for the list
```

Per-package: `pnpm --filter @textui/core <script>`. Node ≥ 22, pnpm 10.

## Layout

```
packages/core/         the runtime and its contracts - published
  src/types/           the contracts. Nothing here imports a runtime value
  src/core/            store, events, when, and the registries
  src/render/          buffer, diff, colour, layout, static rendering
  src/runtime/         reconciler, hooks, paint, style resolution
  src/jsx/             the JSX factory and runtime
  src/themes/          tokens, glyphs, borders, the built-in themes
  src/ui/              the component catalog, by category
  src/app/             the application: frame loop, input routing, teardown
packages/terminal/     adapters, capabilities, ANSI writing, input decoding
packages/testing/      the headless harness
packages/cli/          the developer CLI and CLI primitives
components/            the source-copy registry - copied into projects
playground/            the showcase and the focused playgrounds
```

## Conventions

- **`types/` is the contract, and it is source-first.** Every shape lives in `src/types/` and nothing there imports a runtime value. A consumer that has to reach into `runtime/` for a type is a contract with a hole in it.
- **Registries are late-binding.** Components, commands, themes, layouts, shells and resource viewers are resolved by name at mount time. A missing registration is a runtime miss rendered visibly, not a compile error.
- **The store is the only state.** Paths are `$/scope/...`; scopes are lifetimes, not folders. A component that copies store state into `useState` has created a second answer to one question.
- **`useStore` is state, `useStoreValue` is a view.** `useStore(path, initial)` seeds the path when nothing has filled it in, the way `useState` does, so every reader agrees. `useStoreValue(path, fallback)` never writes: its fallback is what that one component displays while the path is empty.
- **A component fills the space it is given; it does not ask for space.** A viewer, list, tree or table with `flex` or a `height` renders what fits and scrolls - `useMeasure` says how much that is. Sizing from content is what makes a pane move when a different file is opened.
- **Colour is inherited; a tone comes with what to write on it.** A `text` takes its parent's `fg`/`bg` unless it states its own, so a fixed `fg="muted"` inside a row that can be selected is a bug. Use `TONE`/`ON_TONE` rather than pairing a tone with `inverted` by hand.
- **Selection inverts.** A control at rest is a line and a label in its tone; selected, the tone becomes the background. Recolouring only a border is not findable, and loses to any filled control beside it.
- **Meaning never depends on colour alone.** A status is a glyph *and* a colour, because a 16-colour session, a colourblind reader and a piped log all lose the colour.
- **Glyphs come from the theme.** Hardcoding `'│'` or `'●'` in a component is how an ascii terminal ends up with a row of question marks.
- **Sizes are whole cells.** Fractions are distributed by largest remainder so three flex-1 children of a 10-cell row get 4, 3, 3 - never 3, 3, 3.

## Playgrounds are tests

`playground/test/playgrounds.test.tsx` mounts every playground, resizes it, strips the terminal's capabilities and asserts nothing broke. Adding a playground means adding it to `playground/src/registry.ts`; nothing else picks it up, and nothing else checks it.
