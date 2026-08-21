---
title: Glyphs, borders and colour depth
parent: Themes
nav_order: 2
---

# Glyphs, borders and colour depth

The three things a theme resolves against the terminal rather than against
taste. A component states a role; what it gets depends on what the session can
draw.

## Glyphs

The vocabulary is named by role, and the theme resolves it against the
terminal's Unicode level:

| Role | full | ascii |
| --- | --- | --- |
| `bulletFilled` | ● | `*` |
| `bulletHalf` | ◐ | `+` |
| `check` | ✓ | `v` |
| `warning` | ⚠ | `!` |
| `chevronRight` | ▸ | `>` |
| `blocks` | ▁▂▃▄▅▆▇█ | `_.,-=+*#` |
| `spinner` | ⠋⠙⠹⠸… | `\|/-\` |

This is not a fallback nobody sees. It is what an `unicode: 'ascii'` terminal
actually gets, so it has to look deliberate rather than broken.

## Borders

`none` `single` `round` `double` `bold` `dashed` `thick` `half` `ascii`

```tsx
<box border="round" />
<box border={{ style: 'single', color: 'accent' }} />
<box border={{ style: 'single', sides: { left: true } }} />   // a left rule only
```

Naming any side means naming all of them: `sides: { left: true }` is a left rule
and nothing else.

## Colour depth

Colour is reduced by the writer against the terminal's real depth - truecolor,
then the 256 palette, then the 16 ANSI colours, then none. A component never
picks a fallback itself, and a theme does not need per-depth variants.

At depth 0 every token resolves to `default`, which is why meaning must never
depend on colour alone.
