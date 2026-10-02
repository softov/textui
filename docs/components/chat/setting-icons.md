---
title: Setting icons
parent: Chat
grand_parent: Components
nav_order: 5
---

# Setting icons

A mark for a setting, and for the value it is set to, from `@textui/chat`.

```tsx
import { settingIcon, valueIcon } from '@textui/chat';

const question = settingIcon('full', 'permissionMode', 'Approvals');
const answer = valueIcon('ascii', 'bypassPermissions', 'YOLO', { fallback: true });
```

These are hints, not decisions, and the distinction is the whole design.
The settings a session has are the host's: their keys, their titles, their values and the sentence under each one all arrive over the wire, and a client that switched on them would be back to working against one host.
So nothing here is required to match, and an unrecognised setting gets a neutral mark and keeps every word the host gave it.

What the mark buys is a row that survives being squeezed.
The composer's control row truncates labels from the right as the terminal narrows, and a chip that is only a label truncates to nothing legible, while a chip that leads with a mark still says which question it is at four cells wide.

## `settingIcon`

`settingIcon(unicode, key, title)` returns the mark for one of the host's questions, and never nothing.

It is matched on the key and on the label, because hosts disagree about both: the same question is `permissionMode` on one and `autoApprove` on the next, and is titled "Approvals" by one and "Agent Mode" by the other.
The table is ordered and the first match wins, so a harness, a model, a branch, a workspace, an isolation target and an approval mode each get their own mark.
Anything else gets the neutral one.

## `valueIcon`

`valueIcon(unicode, value, label, { fallback })` returns the mark for one of its answers, or `undefined`.

The approval modes are the reason it exists: five of them, all named in the same two words - "Auto Mode", "Plan Mode", "Ask Before Edits" - and a list of five look-alike labels is a list you read twice.
The marks put them in an order you can see, from "asks about everything" to "asks about nothing".

It is ordered too, and the value is tested before the label, because `bypassPermissions` and `autoApprove` both contain "auto" and only one of them means "decide for yourself".
An answer that matches nothing is absent rather than neutral unless `fallback` is true: a branch name is not a mode, and a column of identical dots beside a list of branches is noise with a shape.

Both take a `UnicodeLevel` - `ascii`, `bmp` or `full` - and every mark has an ascii spelling, so a terminal that cannot draw the glyph gets a character it can.

## See also

- [ComposerBar](composer-bar.md) - where the marks are drawn
- [Themes](../../themes/tokens.md) - the glyphs' names and their ascii fallbacks
- [Capabilities](../../terminal/capabilities.md) - where the unicode level comes from
