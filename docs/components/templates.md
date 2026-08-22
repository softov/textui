---
title: Templates
parent: Components
nav_order: 11
---

# Templates

Full screens composed from public components. Copy one and edit it - that is what they are for.

```bash
textui create dashboard
```

`create` also copies the components a template composes, so the result compiles straight away.

| Template | What it is |
| --- | --- |
| `dashboard` | Metrics, a service table and status counts |
| `monitoring` | Gauges, area charts, a heatmap and a timeline |
| `logs` | Full-screen log viewer with filter and level select |
| `explorer` | Resource explorer with registered viewers |
| `login` | Sign-in form with validation |
| `wizard` | Multi-step setup over one form |
| `settings` | Sections, live theme and shell switching, a danger zone |
| `command-center` | Tabs, a table, an actions pane and a status bar |

Every one is built from the catalog and the registry components. None of them reaches into a private API - if a template needs something the catalog does not have, the catalog is missing something.

## What each one demonstrates

**`dashboard`** reads everything from the store, so swapping the fixture for a data provider changes nothing in the file.

**`logs`** filters in the component rather than at the source, because the tail keeps arriving while you narrow it and a filter that discards lines as they land cannot be widened again.

**`wizard`** uses one form across every step rather than one form per step, so going back does not lose what was typed and the final validation sees all of it at once - the only way cross-step rules can work.

**`settings`** writes theme and shell straight through to the application rather than waiting for a save, because a setting you cannot see the effect of is a setting nobody trusts.

**`command-center`** makes everything actionable a registered command, which is why the palette finds it and the status bar can show its shortcut without either being told.
