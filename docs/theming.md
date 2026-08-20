# Theming

Style objects, theme tokens and convenience props. No CSS engine.

## The three ways to style a node

```tsx
<box gap={1} padding={1} border="single" />              // convenience props
<box style={{ gap: 1, padding: 1 }} />                   // a style object
<box style={{ base: { fg: 'muted' }, focus: { fg: 'accent', bold: true } }} />
```

The third is a **stateful style**: the overlays are applied in a fixed order - selected, hovered, active, focused, and disabled last, because a disabled control is not focusable.

## Resolution order

Five sources, merged in one fixed order, so "why is this blue" is always the same walk:

1. the theme's entry for this component (`theme.components.Panel.base`)
2. the component's own `defaultStyle`
3. convenience props written inline
4. the `style` prop
5. the state overlay

## Tokens

A component names a role, never a colour:

```
canvas surface surfaceAlt overlay
border borderStrong borderSubtle
text muted subtle inverted
accent primary secondary
success warning danger info
onAccent onPrimary onSuccess onWarning onDanger onInfo
hover active selected focus disabled
scrim cursor shadow
```

Literal colours still work - `fg="#ff8800"`, `fg="red"`, `fg={{ rgb: [255, 136, 0] }}`
- but a token is what survives a theme change.

### Tones come in pairs

`onAccent`, `onPrimary`, `onSuccess`, `onWarning`, `onDanger` and `onInfo` are what to write *on* a tone once it is the background. There is one per tone rather than a single `inverted` for all of them, because the contrast that works on green is not the one that works on red - and getting it wrong makes a label unreadable exactly when it matters, which is when the control is selected. `TONE` and `ON_TONE` in the catalog state the pairing once.

### The shell owns the page

A shell paints `canvas` and `text` across the terminal, which is what makes a theme a theme rather than a set of accent colours: without it a light theme is dark-theme ink on whatever background the terminal already had, and only the dialogs - which paint their own `overlay` - look light.

This is why `createApp({ root })` mounts that node into `main` rather than replacing the shell with it.

### Colour is inherited

A node with no `fg` takes its parent's; the same for `bg`, and attributes accumulate, so `bold` on a row is bold for what is in the row. A box's own always wins.

This is load-bearing rather than a convenience. A terminal cell holds exactly one foreground and one background, so a `text` that did not inherit would be drawn in the terminal's default colours *and* punch a hole through the fill behind it - which is a label in the wrong colour on a button and a ragged bar of default background across the middle of it.

The corollary, for anyone writing a component: a fixed `fg="muted"` inside a row that can be selected is a bug. Pass `undefined` when the row is selected and let it inherit, because `muted` on a selected background is the one pairing that never reads.

## Glyphs

The vocabulary is named by role, and the theme resolves it against the terminal's Unicode level:

| Role | full | ascii |
| --- | --- | --- |
| `bulletFilled` | ● | `*` |
| `bulletHalf` | ◐ | `+` |
| `check` | ✓ | `v` |
| `warning` | ⚠ | `!` |
| `chevronRight` | ▸ | `>` |
| `blocks` | ▁▂▃▄▅▆▇█ | `_.,-=+*#` |
| `spinner` | ⠋⠙⠹⠸… | `\|/-\` |

This is not a fallback nobody sees. It is what an `unicode: 'ascii'` terminal actually gets, so it has to look deliberate rather than broken.

## Borders

`none` `single` `round` `double` `bold` `dashed` `thick` `half` `ascii`

```tsx
<box border="round" />
<box border={{ style: 'single', color: 'accent' }} />
<box border={{ style: 'single', sides: { left: true } }} />   // a left rule only
```

Naming any side means naming all of them: `sides: { left: true }` is a left rule and nothing else.

## Colour depth

Colour is reduced by the writer against the terminal's real depth - truecolor, then the 256 palette, then the 16 ANSI colours, then none. A component never picks a fallback itself, and a theme does not need per-depth variants.

At depth 0 every token resolves to `default`, which is why meaning must never depend on colour alone.

## The built-in themes

| Theme | Appearance | Border | Density |
| --- | --- | --- | --- |
| `dark` | dark | single | normal |
| `light` | light | single | normal |
| `console` | dark | single | compact |
| `paper` | light | none | airy |
| `workbench` | dark | round | normal |
| `mono` | dark | ascii | normal |

`console`, `paper` and `workbench` are the three house styles, and each is a handful of overrides on `dark` or `light` rather than a whole palette.

## Writing one

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
