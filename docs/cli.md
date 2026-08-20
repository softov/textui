# The CLI

```bash
npx textui init
npx textui add service-table
npx textui create dashboard
npx textui doctor
```

## The source-copy model

`textui add` copies a component's **source** into your project rather than adding an import. You own it, edit it, and it is reviewed with the rest of your code.

What makes that survivable is the receipt written to `.textui/components.json`: origin, version and a content hash per file. The CLI can then tell "you have not touched this" from "you changed it", and never overwrites the second kind without `--force`.

```
$ textui add status-dot
  ! src/ui/status-dot.tsx - you have edited this; left alone (use --force to replace)
```

`textui diff` shows which way things have drifted:

```
  M  status-dot     src/ui/status-dot.tsx   modified     # you edited it
  U  service-table  src/ui/service-table.tsx outdated    # upstream changed
  !  metric-card    src/ui/metric-card.tsx  missing      # the file is gone
```

## Commands

| Command | What it does |
| --- | --- |
| `init` | Write `textui.config.json` and create the component directories |
| `add <names...>` | Copy components and their dependencies |
| `create <template>` | Scaffold a template, pulling in the components it composes |
| `list` | Registry components, templates and themes; `--catalog` for the built-ins |
| `theme [name]` | List themes, preview one, or `--set` the project default |
| `registry add <name> <path>` | Register another registry |
| `diff` | What has drifted from upstream |
| `doctor` | What this terminal can do, and what the project looks like |

Useful flags: `--dry-run` on `add` shows what would be written and writes nothing; `--json` on `list` and `doctor` gives machine-readable output.

## Configuration

```jsonc
// textui.config.json
{
  "componentsDir": "src/ui",
  "templatesDir": "src/screens",
  "alias": "@textui/core",      // rewritten into every copied file
  "theme": "workbench",
  "shell": "workbench",
  "registries": { "internal": "../design-system/registry" }
}
```

The `alias` is what makes the copy fit your project: a file copied into a repo that imports the runtime as `~/textui` gets that import, not `@textui/core`.

## Building your own CLI

`@textui/cli/app` is the argument parser, help renderer and prompts, separated so an application can combine plain commands with interactive screens without a second framework and a second idea of what an argument is.

```ts
import { Cli, promptConfirm } from '@textui/cli/app';

const cli = new Cli({
  name: 'ops',
  version: '1.0.0',
  commands: [
    {
      name: 'restart',
      description: 'Restart a service',
      arguments: [{ name: 'service', required: true }],
      options: [{ name: 'force', short: 'f', type: 'boolean' }],
      async run(args) {
        if (!args.options.force && !(await promptConfirm('Restart?'))) return 1;
        await restart(args.positionals[0]);
      },
    },
    {
      name: 'watch',
      description: 'Open the dashboard',
      run: () => startTui(),          // a full TUI, from the same CLI
    },
  ],
});

process.exit(await cli.run(process.argv.slice(2)));
```

It supports `--flag`, `--no-flag`, `--key value`, `--key=value`, `-k value`, bundled short flags, repeatable options, choices, and `--` to stop parsing. An unknown option is an error rather than a positional, because a typo silently becoming a filename is how a CLI deletes the wrong thing.
