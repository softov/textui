---
title: Theme - what exists today
domain: theme
revalidated: 2026-09-30
---

The theming layer turns a named theme into the colours, glyphs and chrome every component draws with. `@textui/core` owns the tokens, the built-in themes and the resolution; `@textui/widgets` and `@textui/chat` spend them; `@textui/testing` and `@textui/playground` are where a theme change is seen.

## Packages

- [`code://packages/core`](../../../packages/core) - the runtime and the theme contracts. `src/types/theme.ts` is the contract, `src/themes/` holds the built-ins and the registry, `src/runtime/style.ts` resolves a node's props into a `Style`.
- [`code://packages/widgets`](../../../packages/widgets) - the catalogue, and the components that fill a state today by naming a token themselves.
- [`code://packages/chat`](../../../packages/chat) - the transcript and composer rows, which do the same.
- [`code://packages/testing`](../../../packages/testing) - the harness a theme test mounts.

## Contracts

- [`code://packages/core/src/types/style.ts`](../../../packages/core/src/types/style.ts) - `ColorToken`, `StyleColor`, `Style`, `StatefulStyle` and `SemanticVariant`.
- [`code://packages/core/src/types/theme.ts`](../../../packages/core/src/types/theme.ts) - `ThemeDefinition`, `ResolvedTheme`, and `styleFor(component, variants)`.
- [`code://packages/core/src/runtime/style.ts`](../../../packages/core/src/runtime/style.ts) - `resolveStyle` and `flattenStyleInput`, the merge order every component is drawn through.
- [`code://packages/core/src/themes/builtin.ts`](../../../packages/core/src/themes/builtin.ts) - dark, light, console, paper, paper-light, paper-dark, workbench and mono.

## Runtime path

```
createApp({ theme }) -> Themes.resolve(id, caps) -> ResolvedTheme
  -> paint(node) -> resolveStyle(props, theme, component, defaults, InteractionState)
  -> styleFor(component, variant/tone/size) + props.style states -> cells
```

## Tests

- [`code://packages/core/test/themes.test.ts`](../../../packages/core/test/themes.test.ts) - how the on-tokens resolve from a theme's own `inverted` and `text`.
- [`code://packages/testing/test/list-selection.test.ts`](../../../packages/testing/test/list-selection.test.ts) - a filled row always carries the colour written on it.
- [`code://packages/testing/test/list-columns.test.ts`](../../../packages/testing/test/list-columns.test.ts) and [`code://packages/testing/test/components.test.ts`](../../../packages/testing/test/components.test.ts) - the catalogue rendered through the harness.
- [`code://playground/test/playgrounds.test.tsx`](../../../playground/test/playgrounds.test.tsx) - every playground mounted, resized and stripped of capabilities.

## Known gaps

- The interaction state never reaches `styleFor`, so `components.List.selected` is type-legal and read by nothing.
- Components state their state colours themselves: [`code://packages/widgets/src/data/list.ts#L213-L214`](../../../packages/widgets/src/data/list.ts#L213-L214) is the pattern repeated across list, tree, table, text area, code viewer, menu, tabs and two chat rows.
- One union serves every channel, so a background token may be passed as `fg` or `border`.
- `active` means the pressed state in `InteractionState` and an unfocused selection in the components.
- No page names the component and state names a theme may set, because until now there were none.
