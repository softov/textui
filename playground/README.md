# Playground

Every playground in `src/playgrounds/`, plus the filesystem explorer example in `src/examples/`. Run one:

```bash
pnpm dev --list        # what is here
pnpm dev gallery       # open it
pnpm dev charts --ascii --mono   # force a degraded terminal
pnpm dev data --static           # render once to stdout
```

`pnpm dev explorer` is the one to read first. It browses this repository through the resource registry, opens what it finds with whatever viewer is registered for the kind, and lets you pick another from the "Opens with" pane. Select a `.json` file to see the JSON adapter at work: coloured source, a structure view of the same document, and Format / Minify / Sort keys / Validate in the actions pane. The provider is read-only, so those transforms change the open buffer and nothing on disk.

`pnpm dev overlays` is the other one worth reading. Nothing on that screen has an `onPress` that opens anything: the buttons execute commands, and the palette lists those same commands, so running "Show a toast" from the palette and pressing the Success button reach the same code. "Show a toast" and "Switch theme" declare an argument with choices, which is where the palette's second level comes from.

The playgrounds are also a test suite: `pnpm test` mounts every one of them, resizes the terminal under it, strips the terminal's capabilities away and asserts nothing broke. A showcase nobody checks is a showcase that rots.

Three things those tests assert in particular, because all three were bugs:

- Tab reaches every control inside a dialog. A trapped scope filters the tab order to itself, and controls used to register outside it - so tab did nothing at all in any overlay.
- The frame is identical whichever file is open. A viewer scrolls inside its pane; it never resizes it.
- A toast does not remount the screen. Opening a layer used to change the shape of the root node, which quietly reset every component's state.
