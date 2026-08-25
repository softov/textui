---
title: Paths and scopes
parent: Store
nav_order: 1
---

# Paths and scopes

A path names a place in the tree. Its first segment is a **scope**, and scopes are lifetimes rather than folders - which is what makes tearing one down a single call instead of a cascade of resets.

## Paths

```
$/services/list          absolute; the first segment is a scope
/name                    relative to the surrounding data context
$/services/*/status      a wildcard, in subscriptions only
#/config/activePath      the value AT this path is itself a path
$/rows/{{ $/active/id }} another path's value, substituted first
```

`..` is forbidden. Escape to the root with `$/` instead, so a node's meaning never depends on where it was pasted.

## Scopes are lifetimes

| Scope | Dies when |
| --- | --- |
| `local` | the mount goes away |
| `screen` | the screen is popped |
| `session` | the process ends |
| `app` | the application clears it |
| `global` | never, as far as the application is concerned |
| `summary` | derived counts; recomputed, never written by hand |
| `active` | selection, application-wide |
| `ui` | chrome state: collapsed, expanded, scrolled |
| `layout` | surfaces, mounts, the active shell |
| `modus` | the environment: size, capabilities, locale |

`clearScope('session')` is what makes signing out one call rather than a cascade of resets.
