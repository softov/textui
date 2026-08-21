---
title: Decisions and tradeoffs
nav_order: 13
---

# Decisions and tradeoffs

What was chosen, and what it cost.

## JSX compiles to nodes rather than to elements

**Chosen** because it makes one model serve two audiences: a screen can be written in TypeScript with full types, or loaded from JSON, generated, or edited by something that is not a compiler.

**Cost.** Props at a graph boundary must stay serializable, so a closure works in-process but is dropped by `toSerializable`. Actions are the seam: `{ functionCall: { call: 'x' } }` and a closure are interchangeable to a component, which is what keeps the cost bearable.

## Late binding, so a missing name is a runtime miss

**Chosen** because a graph that is data cannot reference a module.

**Cost.** A typo in a component name compiles. The mitigation is that a miss renders visibly - `<NotRegistered>` in the frame - rather than silently producing nothing, and the playground tests assert no such marker appears.

## Only four host primitives

**Chosen** so the layout engine and the painter reason about three shapes and nothing else. Adding a component costs a function, never a case in the engine.

**Cost.** Anything that genuinely needs to paint cells - charts, gauges - goes through `canvas` and gives up participating in layout beyond its own box.

## A flexbox subset, in whole cells

**Chosen** because a terminal has no sub-cell measurement, and the rules people need are grow, shrink, align and absolute positioning. Fractions are distributed by largest remainder, so three flex-1 children of a 10-cell row get 4, 3, 3 rather than losing a cell to rounding.

**Cost.** No wrapping, no baseline alignment, no grid with spans. `Grid` is equal columns; anything else is a `Row` with widths.

## Responsive means dropping columns, not shrinking them

**Chosen** because squeezing every column until none is readable is worse than showing fewer. A column with no stated priority inherits its position, and the first column is never dropped - a row you cannot identify is not a smaller row.

**Cost.** A table's priorities have to be chosen by whoever writes it, and a bad choice is invisible until the terminal is narrow. The playground test resizes to 40 columns for exactly this reason.

## Meaning never depends on colour alone

**Chosen** because a 16-colour ssh session, a colourblind reader and a piped log all lose the colour. Every status is a glyph *and* a colour.

**Cost.** Every component that shows state needs a glyph decision, and glyphs must come from the theme rather than be typed inline - which is a rule people forget, so the playground tests assert that nothing outside ASCII survives an `unicode: 'ascii'` downgrade.

## Input settles between events

**Chosen** because a terminal delivers several keystrokes in one read and a handler closes over its last render's props. Without a render between events, typing quickly drops characters.

**Cost.** A paste that arrives as N key events (no bracketed paste) costs N frames. Bracketed paste avoids it, and the frame diff makes each one cheap.

## Commands are the only way to spell an action

**Chosen** because a button and a palette entry calling the same API are two implementations that will drift.

**Cost.** Ceremony for a one-off action. `onPress` still exists for genuinely local behaviour; the rule is about anything a user could reach two ways.

## The store is authoritative, and the two store hooks say which is which

**Chosen** because two components disagreeing about the same path is the exact failure a single store exists to prevent.

`useStore(path, initial)` is state: it looks like `useState`, so it behaves like it and writes the initial value when nothing has filled the path in. `useStoreValue(path, fallback)` is a view of something someone else owns, and its fallback is a display default that stays local to that reader.

**Cost.** Two hooks where one would do, and a rule to remember about which argument means what. The earlier design had one hook whose second argument never wrote, which read like `useState` and was not - the split is what makes the difference visible at the call site.

## A component fills what it is given; it never sizes itself from its content

**Chosen** after the file explorer: opening a four-thousand-line file moved every pane on the screen, because the viewer rendered one row per line and its parent grew to fit.

Three rules together make that impossible:

- `useMeasure` hands a component the rect it was laid out into, and the frame runs the render/layout pass again when a measurement changed - so a viewer can render exactly the rows that fit, in the same frame.
- A component only trusts that measurement when the layout actually decided its size, which is when it was given `flex`, a `height`, a `maxHeight` or a `basis`. A box sized by its own content would otherwise freeze at whatever it first drew: its measurement *is* its content, so a tree could never grow.
- The layout engine shrinks elastic children before rigid ones and never places a child outside its container, so a pane that is too big cannot push a status bar off the screen or measure itself at a size the terminal does not have.

**Cost.** A component in a container with no definite height renders all of its content, which is right but means `flex` is load-bearing in a way that is easy to forget. Measurement also costs a second render pass in the frame where a size changed.

## Resource adapters bundle what a file type needs, and buffers make actions honest

**Chosen** because "support JSON" is not one registration: it is a kind, a highlighter, two viewers and three transforms, and an application that has to make five calls in the right order will get one of them wrong.

Actions edit a *document buffer* rather than the provider. Formatting a file from a read-only source still shows you the formatted document, and saving is a separate, explicit act that the provider can refuse.

**Cost.** A buffer is a second copy of the content, held in the session scope until the process ends. Browsing a directory of large files keeps all of them.

## The palette runs commands, and asks when a command needs an argument

**Chosen** because a palette that reports a choice for the caller to execute is a palette every caller wires slightly differently - and one of them will run the wrong thing, or nothing.

Sub-items follow from the same idea. A command that needs a `tone` declares the choices; the palette reads them and asks. The alternative was a submenu structure owned by the palette, which would mean every command that wants one has to know the palette exists.

**Cost.** `onRun` is now a notification rather than the mechanism, which is a breaking change for anyone who wired it the old way; `execute={false}` restores the picker behaviour. And a command with an argument cannot be run from the palette without answering the question, even when a default would do.

## Selection inverts, and colour is inherited

**Chosen** after a screen where the focused button was a blue outline and an unfocused one was a filled green block: the eye picks the fill, so the wrong control looked selected. Inverting the tone makes selection the same signal everywhere - a line becomes a fill - and the theme's `on*` tokens keep the label readable on whichever tone that is.

Inheritance is the other half. A cell holds one foreground and one background, so a label that did not inherit was drawn in the terminal's default colours and cut a hole through the fill behind it.

**Cost.** Inheritance means a container's colour reaches further than some authors expect, and attributes accumulate with no way to unset one. Selection also owns the fill now, so `solid` is a weaker signal than it was: it says "this is the primary action", not "this is selected".

## `root` is a mount, and the shell always frames it

**Chosen** after a light theme that stayed dark: `createApp({ root })` returned that node *instead of* the shell, so the application had no canvas, no status surface, no toast host, and `setShell` silently did nothing. Only the dialogs looked themed, because they paint their own background.

`root` now opens into `main` at boot. It is an alternative to screens, not to the shell.

**Cost.** An application that wants a bare node with no shell has to register no shells at all, which is the fallback path rather than the obvious one.

## No dependencies

**Chosen** because every one of them would have to be audited by whoever ships a terminal application to a production host.

**Cost.** Grapheme measurement, ANSI encoding, input decoding, colour downsampling and argument parsing are all written here. Each is small; together they are a real amount of surface. `Intl` is used wherever it can be - number, date, list and plural formatting are the runtime's job, not ours.

## What was deliberately left out

- **A router.** Screens and a stack. An application that wants URLs maps them.
- **A CSS engine.** Style objects, tokens, and convenience props.
- **Dependency injection.** A typed lookup table with a parent chain.
- **A job queue.** Tasks with a lifecycle and cancellation, and nothing more.
- **Fine-grained hot reload.** A reliable full remount that preserves the store beats a clever one that sometimes does not.
