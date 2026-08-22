---
title: Themes
nav_order: 7
has_children: true
permalink: /themes/
---

# Themes

Style objects, theme tokens and convenience props. No CSS engine.

A component names a role - `accent`, `danger`, `bulletFilled`, `single` - and
the theme resolves it against what the terminal can actually do. That
indirection is the whole design: it is why one component is right on six themes
and on a terminal with sixteen colours and no Unicode.

## The three ways to style a node

<!-- docs:nocheck -->
```tsx
<box gap={1} padding={1} border="single" />              // convenience props
<box style={{ gap: 1, padding: 1 }} />                   // a style object
<box style={{ base: { fg: 'muted' }, focus: { fg: 'accent', bold: true } }} />
```

The third is a **stateful style**: the overlays are applied in a fixed order -
selected, hovered, active, focused, and disabled last, because a disabled
control is not focusable.

## Resolution order

Five sources, merged in one fixed order, so "why is this blue" is always the
same walk:

1. the theme's entry for this component (`theme.components.Panel.base`)
2. the component's own `defaultStyle`
3. convenience props written inline
4. the `style` prop
5. the state overlay
