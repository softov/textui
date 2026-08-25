---
title: Building your own CLI
parent: CLI
nav_order: 3
---

<!-- docs:setup
declare const restart: (service: string) => Promise<void>; declare const startTui: () => Promise<void>; -->

# Building your own CLI

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
        await restart(String(args.positionals[0]));
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
