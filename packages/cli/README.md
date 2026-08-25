# @textui/cli

[![npm](https://img.shields.io/npm/v/@textui/cli?label=%40textui%2Fcli)](https://www.npmjs.com/package/@textui/cli) [![license](https://img.shields.io/npm/l/@textui/cli)](https://github.com/softov/textui/blob/main/LICENSE)

`textui` - set a project up, copy components into it, and find out what the terminal in front of you can actually do.

```bash
npx @textui/cli init
```

## Components are copied, not imported

[`@textui/widgets`](https://www.npmjs.com/package/@textui/widgets) is a dependency you install. The registry behind `textui add` is the opposite: it writes the source into your project and you own it from there, edits included.

```bash
textui add service-table     # writes src/ui/service-table.tsx
textui create dashboard      # writes a whole screen
textui diff                  # what you have edited since it was copied
```

`diff` matters because owning the source means upstream fixes do not reach you. It tells you which files have drifted, so an update is a decision rather than a surprise.

## Commands

| | |
|---|---|
| `init` | Set up TextUI in this project |
| `add` | Copy components into your project |
| `create` | Scaffold a template into your project |
| `list` | Registry components, templates and themes |
| `theme` | List themes, or preview one |
| `registry` | Manage component registries |
| `diff` | Which copied components have drifted from upstream |
| `doctor` | What this terminal can do, and what the project looks like |

`doctor` is the one to run first when something renders wrong: it reports the unicode level, colour depth, mouse and keyboard protocol actually detected, which is usually the answer.

## Building your own

`createCli()` is exported, and `@textui/cli/app` is the primitives under it - commands, options, help and prompts. Deliberately small: the point is that an application built on TextUI can combine plain commands with interactive screens without a second framework and a second idea of what an argument is.

## Runtime

Depends on [`@textui/core`](https://www.npmjs.com/package/@textui/core) and [`@textui/terminal`](https://www.npmjs.com/package/@textui/terminal). Uses `node:fs`, `node:path` and `node:crypto` - it is the one library package here that touches a disk. Node 22+ and Bun.

## Documentation

<https://softov.github.io/textui/>

<!-- family -->

---

Part of **[TextUI](https://github.com/softov/textui)** - [documentation](https://softov.github.io/textui/) - [getting started](https://softov.github.io/textui/getting-started.html)

[`@textui/kit`](https://www.npmjs.com/package/@textui/kit) one install · [`@textui/core`](https://www.npmjs.com/package/@textui/core) the runtime · [`@textui/widgets`](https://www.npmjs.com/package/@textui/widgets) the catalog · [`@textui/terminal`](https://www.npmjs.com/package/@textui/terminal) adapters and input · [`@textui/testing`](https://www.npmjs.com/package/@textui/testing) the harness · **`@textui/cli`** the CLI
