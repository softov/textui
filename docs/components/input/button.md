---
title: Button
parent: Controls and forms
grand_parent: Components
nav_order: 1
---

<!-- docs:setup
declare const save: () => void; declare const app: import('@textui/core').TextUIApp; -->

# Button
{: .no_toc }

A focusable action. Enter and space run it.

```tsx
import { Button } from '@textui/widgets';

<Button label="Save" tone="primary" variant="solid" onPress={save} />
```

`variant` decides the shape, `tone` the colour, and they are independent - a `danger` button can be `solid`, `outline`, `ghost` or `link`:

```tsx
import { Button, Row } from '@textui/widgets';

export function Actions() {
  return (
    <Row gap={1}>
      <Button label="Default" />
      <Button label="Primary" tone="primary" variant="solid" />
      <Button label="Danger" tone="danger" />
      <Button label="Ghost" variant="ghost" hint="ctrl+g" />
      <Button label="Disabled" disabled />
    </Row>
  );
}
```

## Props

<!-- props:start -->
| Prop | Type | Default | |
| --- | --- | --- | --- |
| `label` | `string` | **required** |  |
| `tone` | `'default' \| 'primary' \| 'secondary' \| 'accent' \| 'success' \| 'warning' \| 'danger' \| 'info' \| 'muted'` | `'default'` |  |
| `variant` | `'solid' \| 'outline' \| 'ghost' \| 'link'` | `'outline'` |  |
| `icon` | `string` |  |  |
| `hint` | `string` |  | Shortcut hint rendered after the label. |
| `onPress` | `() => void` |  |  |
| `autoFocus` | `boolean` |  |  |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | How much of the screen the button takes, and how heavy its edge is. `md` is a button: three rows, the theme's edge. `sm` is one row with no edge at all, for a toolbar or a row of buttons that must not out-weigh the fields beside them. `lg` is three rows with a heavy one. It matters most when filled. A solid `md` draws its edge in half-blocks, so it stands the same height as the outline button next to it without reading as a heavier object; `lg` fills the edge cells too and becomes the whole rectangle, which is what solid used to do at every size - and why one row of buttons looked bigger than the row above it. |

Plus everything on [`BoxProps`](../base-props.md).
<!-- props:end -->

Role: `button`.

## As a node

A node is plain data, and the JSX above is one way of writing it. The other is the object it compiles to. Nothing in it is a module reference, which is why a screen written this way can be persisted, generated or sent:

```ts
import type { ComponentNode } from '@textui/core';

const saveButton: ComponentNode = {
  component: 'Button',
  label: 'Save',
  tone: 'primary',
  variant: 'solid',
};
```

`<Button label="Save" />` and `{ component: 'Button', label: 'Save' }` are the same value. Every prop below works in both forms; the sections that follow are written as nodes because that is where the difference shows.

See [Nodes](../nodes.md) for the shape in general.

## Handlers

`onPress` takes a closure, or an action - an object describing what to do rather than a function that does it. There are three action forms.

**A closure**, for behaviour that exists nowhere else:

```ts
import type { ComponentNode } from '@textui/core';

const cancel: ComponentNode = {
  component: 'Button',
  label: 'Cancel',
  onPress: { handler: () => save() },
};
```

In JSX this is just `onPress={save}`, and a bare function works in a node too - the resolver passes functions through untouched. The `{ handler }` wrapper is what the library itself writes when it builds nodes as objects, because it keeps the three forms symmetric.

**A command**, for anything reachable more than one way:

```ts
import type { ComponentNode } from '@textui/core';

const saveButton: ComponentNode = {
  component: 'Button',
  label: 'Save',
  onPress: { functionCall: { call: 'file.save' } },
};
```

**An event**, for something published and forgotten:

```ts
import type { ComponentNode } from '@textui/core';

const dismiss: ComponentNode = {
  component: 'Button',
  label: 'Dismiss',
  onPress: { emit: { path: '@/dialog/cancel' } },
};
```

The difference that decides which you can use is whether the node has to stay data. A closure - `onPress={save}` or `{ handler }` - is not data, and `JSON.stringify` drops it. `{ functionCall }` and `{ emit }` are data, and name what to run rather than holding it, so they survive the round trip.

Any handler prop - `onPress`, `onSelect`, `onChange` - takes all four. The runtime resolves the action into a callable before the component sees it, so `Button` receives a function either way and never inspects which form was written. Nothing here is specific to `Button`: every component gets this, including one you write.

### Prefer a command to an `onPress`

A closure is right for a button that means nothing anywhere else. Anything a user might also reach from a keybinding or the palette should be a command, so the three cannot drift apart:

```tsx
import { Button } from '@textui/widgets';

app.commands.register({
  id: 'file.save',
  title: 'Save',
  slots: ['palette', 'hints'],
  run: () => save(),
});

export const SaveButton = () => (
  <Button label="Save" hint="ctrl+s" onPress={() => void app.execute('file.save')} />
);
```

`hint` only draws the string - it registers nothing. The keybinding is still [`app.keybindings.register`](../../platform/keybindings.md), and the hint is there so the button says out loud what the chord already does.

## Reading props from the store

A prop can hold a binding instead of a value. The runtime reads the path, subscribes to it, and re-renders this node when it changes - `Button` needs no support for any of it:

```ts
import type { ComponentNode } from '@textui/core';

const dynamic: ComponentNode = {
  component: 'Button',
  label: { path: '$/session/saveLabel' },
  disabled: { path: '$/session/busy' },
  onPress: { functionCall: { call: 'file.save' } },
};
```

This is not a `Button` feature. Any prop on any component takes a binding - see [Paths and scopes](../../store/paths.md).

## Why focus inverts

At rest a button is a line and a label in its tone. Focused, the tone becomes the background and the label flips to the colour the theme writes on that tone.

Recolouring only the border was tried first and rejected twice over: it was too quiet to find on a busy screen, and next to a `solid` button it read backwards - the filled one looked selected however hard the border tried. A terminal has no hover to fall back on, so if the focused control is not obvious the interface is unusable.

Focus changes how a button looks without changing its size. The filled edge is drawn from block elements whose coloured half faces inward, and it measures one cell a side - exactly what the line border it replaces measured. Nothing reflows when you tab onto it.

`ghost` and `link` are the exceptions to the frame entirely: they are text, and stay one row.

## Size

`size` decides how much room a button takes and how heavy its edge is.

| | Rows | Edge |
| --- | --- | --- |
| `sm` | 1 | none |
| `md` | 3 | the theme's |
| `lg` | 3 | the heaviest the theme can draw |

`sm` is for a toolbar, or a row of buttons that must not out-weigh the fields beside them. `md` is a button.

Size also settles how `solid` sits next to `outline`, which is the reason the prop exists. At `md` the fill hangs on an inner box, so the ring is drawn in half-blocks and a filled button weighs what the outline button beside it weighs. At `lg` the fill runs under the ring and the button becomes one solid rectangle - which is what `solid` used to do at every size, and why a row of filled buttons read as heavier than the row above it.

So a dialog's OK and Cancel sit on the same line whichever way round they are:

```tsx
import { Button, Row } from '@textui/widgets';

export function DialogActions({ onOk, onCancel }: { onOk(): void; onCancel(): void }) {
  return (
    <Row gap={1}>
      <Button label="Cancel" onPress={onCancel} />
      <Button label="OK" tone="primary" variant="solid" onPress={onOk} autoFocus />
    </Row>
  );
}
```

A theme asking for `none` or `ascii` borders keeps them: both are deliberate looks, and the half-block edge degrades to ascii anyway on a terminal that cannot draw block elements.

## See also

- [Editing keys and selection](editing.md) - the keys, the selection and the clipboard
- [Checkbox](checkbox.md), [Switch](switch.md) - a state to toggle rather than an action to run
- [FormActions](form-actions.md) - the submit/cancel row, already laid out
- [Nodes](../nodes.md) - actions and bindings in general
- [Commands](../../platform/commands.md) - registering the thing a button runs
