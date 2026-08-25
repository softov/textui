---
title: Configuration
parent: CLI
nav_order: 2
---

# Configuration

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
