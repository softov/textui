---
title: CLI commands
parent: CLI
nav_order: 1
---

# CLI commands

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

Useful flags: `--dry-run` on `add` shows what would be written and writes
nothing; `--json` on `list` and `doctor` gives machine-readable output.
