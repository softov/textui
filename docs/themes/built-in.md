---
title: The built-in themes
parent: Themes
nav_order: 3
---

# The built-in themes

| Theme | Appearance | Border | Density |
| --- | --- | --- | --- |
| `dark` | dark | single | normal |
| `light` | light | single | normal |
| `console` | dark | single | compact |
| `paper` | light | none | airy |
| `workbench` | dark | round | normal |
| `mono` | dark | ascii | normal |

`console`, `paper` and `workbench` are the three house styles, and each is a handful of overrides on `dark` or `light` rather than a whole palette.

`mono` states `monochrome: true`, so it has no colour to give at all: every
token resolves to the terminal's own, and so does every literal a component
carries. A banner or a chart drawn in its own colours is drawn in yours instead.
