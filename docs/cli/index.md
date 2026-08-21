---
title: CLI
nav_order: 11
has_children: true
---

# CLI

```bash
npx textui init
npx textui add service-table
npx textui create dashboard
npx textui doctor
```

## The source-copy model

`textui add` copies a component's **source** into your project rather than
adding an import. You own it, edit it, and it is reviewed with the rest of your
code.

What makes that survivable is the receipt written to `.textui/components.json`:
origin, version and a content hash per file. The CLI can then tell "you have not
touched this" from "you changed it", and never overwrites the second kind
without `--force`.

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
