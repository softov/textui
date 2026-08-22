# Examples

An example is an **application**. It owns its `package.json`, calls `createApp`
itself, and is laid out the way a project that depends on TextUI would be laid
out. Copying one out of this repo and running it somewhere else should work.

That is the whole difference from a playground, and it is what decides where a
new thing goes:

| | [`playground/`](../playground) | `examples/` |
|---|---|---|
| What it is | a node handed to the shared runner | its own application |
| Owns the app | no - the runner does | yes - its own `main.tsx` |
| Shape | one file, one screen | a folder: state, data, several screens |
| Answers | "does this component work?" | "what does a real app look like?" |
| Registered in | [`registry.ts`](../playground/src/registry.ts) | nothing - the folder is the registration |

A screen that exists to exercise a feature is a playground, however pretty it
is. An example that turns out to be one file and no logic belongs in the
playground instead - it is not earning the package it costs.

## Layout

```
examples/<name>/
  package.json      @textui/example-<name>, depends on core and terminal
  tsconfig.json
  README.md         what it demonstrates, and what to look at first
  src/
    app.tsx         exports the root node and its registration - importable
    main.tsx        createApp, the terminal session, the quit key
  test/
    smoke.test.tsx  mounts it, resizes it, strips capabilities
```

`app.tsx` and `main.tsx` are split so the example can be *mounted* without being
*run*. That is what lets the smoke test exist, and the rule from the playground
holds here too: an example nothing checks is an example that is already broken.

## What is here

| | |
|---|---|
| [`todo/`](todo) | pages and a stack: list, detail, collection, search, settings - and the difference between a surface, a screen and a layer |
| [`arcade/`](arcade) | snake, tetris and breakout: the ticker as a game loop, the canvas as a playfield, and a key that means two things in two places |

## Running

```bash
pnpm example --list         # every example
pnpm example <name>         # run one
pnpm example <name> --static --width 100    # render one frame to stdout
```

The runner bundles from the workspace sources, so a change to the runtime shows
up on the next run with no build in between. A consumer outside this repo would
build with `tsc` and run the output instead - the example's own `build` script
does exactly that, and is there to prove the published packages are enough.

## logtail.mjs

Watch what a textui application is doing, from outside it.

A terminal application cannot print its own diagnostics, because the screen is
the output. So it sends them somewhere else instead - a file, or a unix socket
with this listening on the other end.

```bash
node examples/logtail.mjs /tmp/textide.sock
node packages/textide/dist/main.js ~/scratch --log-unix /tmp/textide.sock
```

```text
    141ms event   @/command/run   {"id":"file.edit","source":"api","args":{}}
    199ms store   $/focus/id      n124:focus
    199ms store   $/focus/scope   pane.main
```

Add `--verbose` to the application for every store write rather than only
focus, chrome and commands, and pass substrings to filter:

```bash
node examples/logtail.mjs /tmp/textide.sock focus
```

`--log-file <path>` writes the same JSONL to a file, for a run you want to read
afterwards rather than watch.

What is recorded is the runtime's own vocabulary - `$/focus/id` moved, a
command ran, a surface changed - rather than narration written at each call
site, so the log cannot drift from what actually happened.
