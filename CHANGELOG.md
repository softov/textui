# Changelog

The packages release as a set under one version.

## Unreleased

### Added

- A field's text colour is the theme's, under the field's own name:
  `components: { TextInput: { base: { fg: 'text' } } }`. `TextInput` states
  `styleAs` now, so the box a person types in can be coloured like any other
  component - and the palette's search box, which is one of them, with it.
- `Menu` takes `noMatch`: a line of its own for an empty list, or `false` to
  draw none. A palette knows which kind of nothing it is looking at and says so
  itself, so it turns the menu's line off rather than saying it twice.
- `Menu` states `base: { fg: 'text' }` in the built-in themes, so a menu's rows
  take the theme's text colour the way a field does.

### Changed

- **Breaking.** `dark`, `light`, `paper` and `paper-dark` draw a selected row
  with no fill. `selected` and `active` are `default`, and the row is written in
  `onSelected`, bold while the component has the keyboard, or in `onActive`
  when it does not. Each of these themes states its own `onSelected` and
  `onActive`, so a theme that extends one and brings a fill back has to state
  them too - `console`, `workbench` and `paper-light` now do.
- `dark`'s `text` is `#f3e6f1` and its `subtle` is `#546f94`.
- `components.Editor.selected` is reverse video rather than the `active` fill,
  so a selection in the editor shows whether or not the theme has a fill, and
  keeps each token's own colour.

### Fixed

- The editor draws the `bold` and `inverse` a theme states for its selection.
  It kept only `fg` and `bg`, so any other part of `Editor.selected` was
  dropped.
- The line under a palette's list no longer keeps the last answer's sentence when
  nothing is selectable, and no longer counts nothing: the count is there when
  there is something to count.

### Fixed

- A marquee counts from its own first frame. The ticker hands it the
  application's frame number, so a marquee whose count started at zero began at
  whatever frame the application happened to be on: opening a menu after a while
  drew the label already scrolled, cut at the left, until the cursor moved and
  reset it.
- A shell's frame is drawn in the theme's `border` colour, not in its own text
  colour. A box that states an `fg` draws its border in it, which is right for
  `<box fg="danger" border="single">` and wrong for a shell: the workbench shell
  states `fg: 'text'` for its content, so the outermost edge of every screen
  came out as bright as the words inside it and the `border` token went unused.
  `console` and `paper` state no border and still draw none.

## 0.8.0

### Added
- `onSelected` and `onActive`: the colour written on a filled selection, derived from the theme's `inverted` and `text` unless the theme states them.
- `I18n.plural(count, forms, values?)`: the `values` fill the rest of the sentence around `{count}`, so a form can carry a glyph or the total a count is out of.
- `ChatComposer.commandWidth`: the least the slash menu's name column is given. A longer name widens it, because a floor is not a cut.
- `ChatComposer.commandDescription`: `{ lines, wrap }`, how many lines a command's description may take and whether it wraps into them. Wrapped, the row is that tall and the menu fits proportionally fewer rows.
- `CommandList` in `@textui/chat`: the completion menu's rows as a component of their own, with the name column, the description options and the row height. The composer renders it for commands and keeps the plain list for paths.
- `KeyValue.labelGap`, `labelAlign` and `valueAlign`, and `labelAlign`/`valueAlign` on a single item to override the block. `labelGap` is added to the widest label when the column is computed.
- `markCut(text, width, ellipsis)`: fits into the width and marks the cut whether or not there was one, for text stopped by its box rather than by its own length.
- `FontText`: text drawn in a block font, one glyph table to a letter, with the table's placeholders filled from the theme so a banner survives an ascii or sixteen-colour terminal. `wrap: 'word'` breaks the text between its words to the box's width, measured in the font rather than in cells - never the drawn block, whose rows are rows of letters. `lineGap` sets the blank rows between lines, `0` merging a font's own ground into one texture.
- `bannerLines(text, font, ink, width)`: the block letters one line at a time, for a caller that has to place them itself - the case that needs it is centring each line, where a single multi-line block is centred once and its shorter lines read as left-aligned.
- The block fonts and their engine ship with `@textui/widgets`: `FONTS`, `fontAt(id)`, `DEFAULT_FONT`, `banner(text, font, inkGlyphs)` and `inkGlyphs(glyphs, unicode)`. They moved out of `examples/ink`, which now imports them - `Font` is the contract, so an application can still bring its own table.
- `Pattern`: a tile repeated across and down a box - a texture under the children or a motif over them. `ascii` is the substitute tile for a terminal that cannot draw the first one, `spacing` and `jitter`+`seed` space the copies out or break the lattice reproducibly, and `transparent` leaves the cells behind them alone. `ink` colours the tile cell by cell - the same `Ink` `ColorText` takes - with the pattern's own box as the coordinate space.
- `components.<Component>.<state>` on a theme, where the state is one of `selected`, `hover`, `active`, `focus` or `disabled`. A theme states a component's state colours where the component is, so restating one component's selection no longer repaints every list, tree, table, menu, tab and field in the application. The built-in themes carry the defaults.
- `focused` on any node: a tri-state, so a component whose boxes do not hold the keyboard themselves can say which of them the keyboard is on. A list row is told, and `List.selected` and `List.focus` are then two answers rather than one.
- `styleAs` on any node: which of a composite component's boxes a theme styles. `components.List` was a key nothing read, because a list row is a plain `box`.
- A state may be qualified by a variant: `components.Tabs['solid.selected']`. Whether a selected tab paints at all is a property of the variant rather than of the state, and `Tabs.selected` has to mean the pair for both.

### Changed
- `monochrome` on a theme, and `mono` states it: every colour resolves to the terminal's own, literals included. A theme whose palette is all `default` still showed an ink's own hexes, which is how a monochrome screenshot came out with a rainbow banner in it.
- `Card` states `bg: 'surface'`, so it clears what is behind it. A bordered box that states no background is a frame around whatever is already there, which is why a card dropped over a `Pattern` showed the tile through its own interior; `Dialog` and `CommandPalette` have always stated a background for the same reason. A caller that wants another fill names one.
- **Breaking.** A list, tree, table, text area, code viewer, menu, tab, tool call, reasoning, composer chip or editor row states which states it is in; the colours come from the theme. Where this states one:

  ```ts
  // before
  h('box', { role: 'listitem', bg: active && focus.focused ? 'selected' : active ? 'active' : undefined,
             fg: active ? (focus.focused ? 'onSelected' : 'onActive') : undefined })
  // after
  h('box', { role: 'listitem', styleAs: 'List', selected: active, focused: active && focus.focused })
  ```

  A custom component that drew its own selection is now overridden by nothing and helped by nothing: give it a `styleAs` and a `components` entry, and leave the colours off the node. An explicit `bg` or `fg` prop still wins over the theme, so a caller who needs one row in one state different does not have to register a theme to get it.
- **Breaking.** A colour is typed by its channel. `fg`, `bg`, each border side and `scrim` take their own token list, so `fg="canvas"`, `bg="onSelected"` and `border: { color: "text" }` no longer compile. The two quiet foregrounds, `muted` and `subtle`, are still legal rules. `ColorToken` is still the union of the three, so a theme's `colors` map is unchanged. A literal colour is still accepted anywhere a colour is.
- **Breaking.** Inside a selected row, the texts take no `fg` of their own, so they inherit the fill's foreground from the theme. A hard `onSelected` here was a second answer to a question a theme restating `Menu.focus.fg` could not reach.

### Fixed
- A wrapped text with more lines than the box it was given now ends its last visible row with the theme's ellipsis. It stopped mid-sentence and read as the whole of it, which is the failure `truncate` prevents sideways.
- The slash menu's name column is one width for the whole menu, so the descriptions line up instead of starting after each row's own name. A name that will not fit is cut with the theme's ellipsis rather than squeezed by the source column beside it.
- Counts inflect: a session row says `1 file`, a connection badge `1 session`, a table footer `1 item`, and the reasoning, tool-call, markdown, binary and too-large-message lines each have a singular form.
- `paper` states `onActive`, because its `text` is the terminal's own and a filled row cannot be read on a colour the user may have picked.
- `workbench` names the light text on its grey selection, which the inherited `inverted` nearly disappeared against.

## 0.7.0

### Added
- Widgets and chat text goes through `app.i18n` under `textui.*` keys, English by default.
- `I18n.t(key, values?, fallback?)`: an optional fallback.
- `ConfirmDialog` and `PromptDialog`, mounted by `confirm()` and `prompt()`.
- `ChatToolCall.invocation`: the host's one line for a tool call.
- A queued block's `model`, shown beside the message.
- `DetailField.parts`: a value in pieces, each with its own tone.

### Changed
- Tab order follows the layout, so a field mounted late is reached where it is drawn.
- The palette shows each category under one heading.
- A tool call's row shows `invocation` before its input.
- The transcript cursor highlights a block's header line only.
- `SessionList` shows change counts in green and red.

## 0.6.1

`@textui/chat@0.6.0` was published with `workspace:^` ranges and cannot be installed. It is deprecated and the set skips 0.6.0.

### Added
- `@textui/chat`: transcript, composer, tool call row, question and confirmation blocks, session list and file diff.
- `ReasoningBlock.onToggle`, and a divider under an open thought.
- A cursor bar in the gutter of every transcript block.
- `ArgSpec.choices(collected)`, so a later argument can depend on an earlier one.

### Changed
- The palette sizes to its text up to `maxWidth`, and states the question once.
- `openPicker` runs a command that has nothing to ask.

### Fixed
- `@textui/cli` finds its registry on Windows.

## 0.5.0

### Added
- `text` takes `match`, `matchFg` and `matchBg` to colour a term; so does `MarkdownView`.
- `Feed.pinSelection` keeps the selection in view.

### Fixed
- `CommandPalette` shows `CommandDefinition.checked`.
- `Feed` scrolls to a `selectedIndex` set by the caller.

## 0.4.0

### Changed
- Text measurement is cached, and mouse events share one frame.
- `Feed` collapses off-screen runs into one box.
- `Feed` draws `ScrollThumb`.

### Fixed
- A resize repaints every cell.
- An empty field shows its caret.
- The cursor hides when focus leaves a text field.

## 0.3.0

### Added
- `useFrame(fps, { enabled })`.
- `TextUIApp.settled()`.
- `renderStill({ width, height, ...appOptions })`.

### Changed
- `Feed` lays out only the entries near the viewport.
- Prop resolution keeps array and object identity when nothing changed.
- The workbench sidebar does not shrink.

### Fixed
- A shell registered after boot keeps the root on screen.

## 0.2.0

### Added
- `TextInput` takes the mouse; `TextArea` selects by click, drag, double and triple click, and copies over OSC 52.
- Hover on any node, with `onHover`.
- `onMouse` returning `true` on `down` claims the drag and the release.
- `Feed.pageKeys: 'always'`.
- `HostConnection.onSessions`.
- `ArgSpec.default` opens a picker on the current answer.
- `descriptions: 'below'` on `Menu`, `CommandPalette` and `ArgSpec`.
- `MenuItem.sectionBefore`; the palette shows a category as a heading.
- A theme's `cursor` shape, and `divider` and `dividerChars`.
- `Checkbox` and `RadioGroup` take `autoFocus`.
- `@textui/testing`: `clickRepeat` and `drag`.

### Changed
- A palette with no `width` sizes to its rows, up to `maxWidth`.
- A narrow `List` row drops the description before the status.
- `Divider` takes `rule` instead of `style`.
- Publishing uses npm trusted publishing.
- The facade is `@textui/kit`.

### Fixed
- `autoFocus` skips nodes focus cannot land on.
- OSC 52 is on for any terminal but `screen`.
- `Store.notify` no longer allocates per subscription.

## 0.1.0

First publish: `@textui/kit`, `@textui/core`, `@textui/widgets`, `@textui/terminal`, `@textui/testing` and `@textui/cli`.
