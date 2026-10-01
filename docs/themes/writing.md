---
title: Writing a theme
parent: Themes
nav_order: 4
---

<!-- docs:setup
declare const app: import('@textui/core').TextUIApp; -->

# Writing a theme

A theme extends another and restates only what changes, so a house style is a handful of overrides rather than a whole palette.

```ts
app.themes.register({
  id: 'midnight',
  name: 'Midnight',
  appearance: 'dark',
  extends: 'dark',            // restate only what changes
  border: 'round',
  density: 'compact',
  colors: { canvas: '#0b0c10', accent: '#66d9ef', border: '#2a2d34' },
  glyphs: { bulletFilled: '◆' },
  components: {
    Panel: { base: { padding: [0, 1] } },
    Button: { base: { padding: [0, 2] }, primary: { bold: true } },
  },
});

app.setTheme('midnight');
```

`components` is keyed by component name, then by variant - the variant keys a component understands come from its `variant`, `tone` and `size` props.

`monochrome: true` says the theme has no colour at all, and it is not the same
statement as a palette whose entries happen to be `default`: every colour
resolves to the terminal's own, including the ones a component states for
itself. That matters because a component can carry a literal - an ink, a chart,
a hand-picked hex - and a literal is not something a palette can restate. It is
what [`mono`](built-in.md) says, and the only way a theme that promises no
colour can keep the promise.
