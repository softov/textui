# Changelog

The publishable packages release as a set, under one version. `workspace:^` between them means a mixed set resolves to a combination nobody tested, so the tag is the version and every package carries it.

This file records the set. Anything package-specific says which package.

## Unreleased

### A subscription check that allocated on every miss

`Store.notify` asks every subscription whether a write touches it, so the check runs per subscription per changed key - and its last clause built the changed key's whole ancestor list and scanned it. That clause could never say yes: `ancestorKeys(k).includes(subKey)` is the same set as `isDescendantKey(k, subKey)`, which had already returned `true` two lines above. So the array was built, scanned, and thrown away on every subscription a write did *not* touch, which is nearly all of them.

`keysTouch(a, b)` is what is left - the relation is symmetric, and there is nothing to allocate. Around 2x on a screen's worth of subscriptions. `ancestorKeys` had no other caller and is gone.

`layoutBox` partitioned its children with two `filter` passes, one per frame per box; it is one loop now.

### `TextInput` ignored the mouse

Clicking it did nothing - no focus, no caret. An empty one has nothing in it to say it is a field, so what a form built out of them looked like was a stack of gaps that ignored every click. `TextArea` has answered the mouse from the start; the two disagreeing is what made a form built out of the single-line one unusable with a mouse.

### A control that asked for focus did not get it

A scope that asks for `autoFocus` takes focus as its first control arrives - and a `global` key handler registers as a focusable, because that is how a layer reads escape without holding focus. It is `skipTab`, so it is not a place focus can land, and handed it anyway focus sat on a node that consumes nothing: the keys fell through to whatever was behind, and every real control's own `autoFocus` then stood down, because it claims focus only when the scope does not already hold it.

So a dialog that drew a text field, put `required` beside it and disabled its Send button until the field was filled in was one where every key typed at the field went to whatever was on the screen underneath. The scope's claim now passes over anything that is not somewhere focus can land.

`Checkbox` and `RadioGroup` take `autoFocus`, which they had no way to say before.

### A catalogue is only as fresh as what it was last told

The client subscribed to one session's channel and to nothing else, so a session appearing, finishing or starting to wait was invisible until somebody navigated away and came back - a reader doing by hand what the host had already said. `HostConnection.onSessions` is the catalogue moving, as opposed to one session's channel; the live client raises it from the root channel it was already draining for something else.

The header had the other half of it: `openSession` is a plain read, so a title or a status arriving changed the store and left the row showing what it said when the session was opened.

### `pageKeys: 'always'` on a Feed

For the feed that *is* the screen, with a text field under it. Somebody typing a message who presses page up means the conversation above them, and taking the keyboard off the field to use those keys is the thing they are avoiding. Only those two keys, and only after the focused node has declined them - so a field that pages its own content keeps them.

### Hover works on things that are not focusable

`onHover` was declared on every node and called from nowhere, and the `hover` style overlay was driven by comparing a focus id against `props.id` - so only a focusable node could ever be hovered. A row that is clicked rather than focused, which is most of them, had a `hover` style nothing could trigger.

Hover is now a hit test over laid-out boxes and inherits down the chain the way it does in a browser: a row is hovered while the pointer is over the label inside it, because the label is what the hit test finds. `onHover` fires once on the way in and once on the way out.

### A selection made with the keyboard copies

`shift` with the arrows highlighted something that was not on the clipboard, which is a selection you have to make again with the mouse. `ctrl+left` and `ctrl+right` also move a word at a time now, and select one with `shift` held.

### Double click takes a word, a third click takes the line

In `TextArea`. Letters with letters, spaces with spaces, punctuation with punctuation - so a double click in the gap between two words takes the gap. A newline joins nothing, so a word never runs across a line break, and the third click takes the logical line rather than the row it was drawn on. A fourth comes back round to a caret.

None of that arrives from the terminal: the wire reports presses and releases and has no notion of a double click. `MouseEvent.at` is a timestamp stamped by whatever produced the event, and the count is same-cell-within-450ms arithmetic on top of it. `@textui/testing` gains `clickRepeat(x, y, times)`; `click` deliberately steps its clock past the window, so two clicks in a test are two clicks.

### OSC 52 was switched off in the one place it exists for

The clipboard capability required a recognised terminal, and none of the variables that name one survive an ssh hop - `TERM_PROGRAM`, `KITTY_WINDOW_ID` and `WT_SESSION` are set by the terminal you are sitting at, not by the machine the program runs on. So a remote session saw a bare `xterm-256color`, decided the terminal could not take a clipboard write, and dropped every copy. Reaching the clipboard of a machine the program is *not* running on is the whole reason OSC 52 was specified.

It is on now for anything not known to mangle it, which is `screen` alone: a terminal that does not implement OSC 52 ignores the whole string rather than printing part of it, because an OSC runs to its terminator.

### A picker opens on the answer that is in force

`ArgSpec.default` is where a command says what its argument is currently set to, and the palette now starts the cursor there instead of at the top of the list. Opening at the top says the first option is the current one, which is wrong on every list where it is not.

A panel opened from a control is also that control's toggle: opening the same one again closes it, rather than closing and reopening it - which looks exactly like the click doing nothing.

### A palette sizes to what it holds

`width` left off, the panel is as wide as its widest row and no wider than `maxWidth` (60 by default). A constant is too wide for a list of one-word answers and too narrow for a list of sentences, and it is the same constant either way. A stated `width` is still a width.

A description on its own line is a `Marquee` like the inline one, so the row under the cursor slides what it had to truncate.

### A description can have a line of its own

`descriptions: 'below'` on `Menu` and `CommandPalette` gives each row's description a line under the label instead of a column beside it. `ArgSpec.descriptions` says it per argument, because the argument is what knows: a list of branch names has nothing to say under each one, and a list of approval modes is *only* told apart by what is under each one. Inline, that sentence shares the width with the label and every answer shows the same truncated half.

### A narrow `List` row gives up the description, not the status

All three columns shrank together, so a catalogue at 58 columns cut the label to "Kqueue events on Li…" *and* the status to "waiting on y…" in order to keep a workspace path nobody was scanning for. The description yields first now, and `meta` yields nothing - the same rule `Menu` already followed.

### The palette says a category once, over its group

The category was in every row's right-hand column, so four screens read "Screens, Screens, Screens, Screens" - in the width the rows needed for saying what they *do*, and still without marking where a group started. It is a heading over the group now, and the column is back to the command's `description`.

`MenuItem` gains `sectionBefore`, which takes the line `separatorBefore` would have used rather than adding one. Typing turns the headings off: a query sorts by relevance, which interleaves the categories, and a heading over a single row is not a group.

### A mouse gesture belongs to whoever started it

Mouse dispatch is a hit test, so a `drag` only ever reached the node the pointer happened to be over - which is not the node the drag is *about* the moment the pointer leaves it. An `onMouse` that returns `true` on a `down` now claims the `drag`s and the `up` that follow, wherever they land, until the button comes back up. See [`onMouse`](docs/components/base-props.md).

Nothing had a drag handler before this, so nothing changes for anything that does not want one. `@textui/testing` gains `drag(from, ...to)`, which sends the whole gesture - the press, the points between and the release - because the parts in the middle are the only ones a handler can be wrong about.

### `TextArea` takes the mouse

A click puts the caret where it landed, a drag selects, and the release puts the selection on the system clipboard over OSC 52 and into the store. Dragging past the edge of the field scrolls it. `shift` with the movement keys extends the selection, typing and `backspace` replace it, and `escape` clears it before it reaches `onCancel`.

That is a debt being paid rather than a feature: reporting mouse events takes the terminal's own select-and-copy away, so an application that reads the mouse has to hand one back. `copyOnSelect={false}` opts out of the clipboard half.

### A theme can say what shape the caret is

`cursor` on a theme is `block`, `underline` or `bar`, applied to the terminal's own caret through `TerminalAdapter.setCursorShape` (DECSCUSR) and reset at teardown only if the session set it. It is also the default for `TextArea`'s drawn caret, so the two do not disagree about the same caret - `bar` arrives there as an underline, since a bar between two characters is the one caret that occupies a cell of its own.

### A divider is not a border

`divider` and `dividerChars` are their own theme setting with their own six sets, resolved down the `extends` chain the way borders are. A borderless theme can still separate with a line, which it could not when the rule was drawn from the border style. `Divider` takes `rule` rather than `style`, which collided with `BoxProps.style`.

Publishing moved to npm trusted publishing: GitHub Actions exchanges an OIDC token for a short-lived credential, and there is no `NPM_TOKEN` in the repository any more.

Two things made that more than a flag. Trusted publishing cannot *create* a package - npm only attaches a trusted publisher to a name that already exists, so 0.1.0 still had to be bootstrapped with a token, which was then deleted. And `pnpm publish` has no OIDC support, while `npm publish` cannot read `workspace:^`; `scripts/release-publish.mjs` resolves the ranges and publishes each package from its own directory in dependency order.

### The OIDC exchange only happens with no credential configured

`actions/setup-node` writes `_authToken=${NODE_AUTH_TOKEN}` into an `.npmrc` whenever it is given a `registry-url`. With nothing to substitute, that is an empty credential rather than no credential, and npm treats any `_authToken` line as auth already being configured - so it never asks GitHub for a token. The release workflow no longer sets `registry-url`, and `scripts/check-no-npm-auth.mjs` fails the run if a credential appears anyway.

### The facade is `@textui/kit`, not `textui`

npm refused the unscoped name: "Package name too similar to existing package `text-ui`". That package is a tombstone - zero versions, no maintainers, nothing published since 2022 - but npm reserves the names of unpublished packages permanently, and the reserved name still trips the similarity check.

The bare name is not taken, only blocked, so it may become available if npm lifts the check. Until then the one-install entry point is `@textui/kit`. The `textui` *command* is unaffected: it is the bin of `@textui/cli`, and a bin name is not a package name.

### 0.1.0 - the first publish

Six packages: [`@textui/kit`](packages/facade), [`@textui/core`](packages/core), [`@textui/widgets`](packages/widgets), [`@textui/terminal`](packages/terminal), [`@textui/testing`](packages/testing) and [`@textui/cli`](packages/cli).

`@textui/documents`, `@textui/textide` and `@textui/textide-git` are in the repository and build in CI, but are held back from this release - they are marked `private` until their surface settles, so `pnpm publish -r` skips them.

Pre-1.0: the surface is still moving.

#### Fixed before publishing

- `@textui/core` declared an `./hooks` export subpath pointing at `dist/hooks/`, which is never emitted - hooks live in `runtime/hooks.ts` and are already re-exported from the root. Nothing in the repository imported the subpath, so nothing caught it; it would have been `ERR_MODULE_NOT_FOUND` for the first consumer who tried it. The subpath is gone, and `scripts/check-exports.mjs` now runs in CI so the next one fails a PR.
- Every package ships the MIT `LICENSE` in its tarball. `license: "MIT"` in the manifest is not the licence text, and npm only includes a `LICENSE` that sits in the package's own directory.
- Package READMEs linked to sibling packages relatively (`../core`), which resolves in the repository and 404s on npmjs.com. They are absolute now.
- The documents guide said the JSON adapter ships in `@textui/core/adapters`. It ships in `@textui/documents`; `core/src/adapters` is a deliberately empty placeholder, and says so.
