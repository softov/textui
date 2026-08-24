# Developing TextUI

For working *on* TextUI. To build something *with* it, start at
[`README.md`](README.md) and the [documentation](https://softov.github.io/textui/).

Node >= 22, pnpm 10.

## Getting set up

```bash
pnpm install
pnpm build          # every package
pnpm typecheck      # every workspace
pnpm test           # every suite
pnpm dev --list     # the playgrounds
pnpm dev gallery    # open one
```

Releases are cut from a tag and publish as a set -
[`RELEASING.md`](RELEASING.md) is the runbook, [`CHANGELOG.md`](CHANGELOG.md)
the record.

The docs site is Jekyll, and needs no Ruby on your machine - it builds in a
container:

```bash
scripts/docs-serve.sh           # live, with reload, at localhost:4000/textui/
scripts/docs-serve.sh --build   # build once, into docs/_site
scripts/docs-preview.py         # serve what was built, at localhost:8000/textui/
scripts/docs-preview.py --host 0.0.0.0   # ...and reachable from the network
node scripts/check-docs.mjs     # the nav tree, links and titles
```

`docs-preview.py` exists because the site is built with `baseurl: /textui`, so every link in it is absolute at `/textui/...`. A plain `python -m http.server` over `docs/_site` 404s on all of it; this one mounts the site under the prefix the pages actually ask for.

Node ≥ 22, pnpm 10.

## The acceptance test

The three layouts this project started from - a dense bordered console, an airy borderless report, and a workbench frame - are one architecture with three registrations. `playground/test/playgrounds.test.tsx` mounts the same component under all of them, and under six themes, at three terminal widths, with and without Unicode and colour. If a shell ever needs a component the others cannot use, the boundary is in the wrong place.

## Why TypeScript, and how close it is to needing no build

Types are stripped rather than compiled now. Node has erased them since 22.6
behind a flag, and by default since 23.6 - so a `.ts` file with no non-erasable
syntax in it is a file Node runs. Nothing transpiles it; the annotations are
skipped the way a comment is.

That is the direction this library is aimed at. It has no dependencies, so the
only thing between the source and a `node` invocation is the syntax it uses -
and most of the syntax is already fine. Types, interfaces, generics,
`satisfies`, `as`, `import type`: all erasable, all stripped.

**What is not, here:** fourteen parameter properties (`constructor(private x: T)`)
across twelve files. That form declares a field *and* assigns it, so there is
runtime behaviour inside a type annotation and stripping cannot be correct.
Enums and value-carrying namespaces are the other two, and this codebase has
neither.

Setting `"erasableSyntaxOnly": true` in the tsconfig would make the compiler
refuse the non-erasable forms, turning this from an aim into a constraint. It
is not set yet, and the fourteen are still there - each one a mechanical
change, the field written out and assigned in the body. Treat this section as
the direction the library is aimed at, not a property it already has.

## Releasing

The publishable packages go out as a set, from a tag.
[`RELEASING.md`](RELEASING.md) is the runbook and [`CHANGELOG.md`](CHANGELOG.md)
the record. Two guards run in CI:

```bash
pnpm check:exports          # every exports/bin target exists in the built tree
pnpm check:version 0.1.0    # the tag and the manifests agree
```

`check:exports` is there because tsc cannot catch a subpath nothing in the
repository imports - `@textui/core` shipped a broken `./hooks` for exactly that
reason, and it compiled clean the whole time.

## Conventions

The rules a change has to hold to are in [`CLAUDE.md`](CLAUDE.md): what lives in
`types/`, why registries are late-binding, why the store is the only state, and
how colour, glyphs and sizing work. A component that breaks one of those will
pass `pnpm test` and still be wrong.
