# Changelog

The packages release as a set under one version.

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
