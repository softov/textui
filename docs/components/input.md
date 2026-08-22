---
title: Controls and forms
parent: Components
nav_order: 3
---

<!-- docs:setup
import { fieldValidators, useForm, validators } from '@textui/core';
declare const save: (values: Record<string, unknown>) => void;
-->

# Controls and forms

What takes input, and the machinery around a screenful of it.

## Controls

`Button` `Checkbox` `Switch` `RadioGroup` `Slider` `TextInput` `TextArea` `Select` `SearchBox`

Every one is focusable and states its own focus ring. A terminal has no hover to
fall back on: if the focused control is not obvious, the interface is unusable.

`TextInput` publishes a real cursor position when the terminal has a cursor, so
the caret is where typing lands rather than a drawn approximation - counting the
label and the search glyph before it, and scrolling the value sideways to keep
the caret in view. `hideLabel` keeps the label as the field's accessible name
without drawing it inside the field, for a form or a dialog that already shows
it.

`TextArea` is the one that is a paragraph: it grows to what has been typed,
then stops and scrolls, takes a newline that is not a submit (`alt+enter` or
`ctrl+j` - never `shift+enter`, which most terminals cannot tell from `enter`),
and hands back every key it does not want. Passing `onSubmit` is what makes
enter mean "done"; without it, enter is a newline like any other key.

It also settles the question a single-letter keybinding raises. The focused
node is offered a key **before** any keybinding, so while a text field has the
keyboard, `q` is a letter - which is what lets an application with a composer
in it keep `n`, `r` and `d` as commands, and why a global `q` for quit is a key
that only works where nothing happens to be reading it.

Both fields take a `focusId`. Without one a control's focus id is derived from
its instance, which nothing outside the render can know - so a command that
means "focus the filter" has nothing to name.

`Button` **inverts when it is selected**: a line and a label in its tone at rest,
and when focused the tone becomes the background and the label flips to the
colour the theme writes on that tone. Recolouring only the border was too quiet
to find, and next to a filled button it read backwards - the filled one looked
selected however hard the border tried.

Variants change how a button looks, never how much room it takes: `solid`
reserves the same ring `outline` draws and fills it, so a dialog's OK and Cancel
sit on the same line whichever way round they are. `ghost` and `link` are text,
and stay one row. `Badge` is inline and stays one row too, which is why its
`outline` variant is brackets rather than a box.

## Forms

`Form` `Field` `FormSection` `FormActions` `DangerZone`, plus `useForm`,
`validators` and `fieldValidators`.

Validation runs over a whole values object rather than per field, because the
rules people actually need are cross-field:

```tsx
type Credentials = { password: string; confirm: string };

const form = useForm<Credentials>({
  initialValues: { password: '', confirm: '' },
  validate: (values) => {
    const errors = fieldValidators<Credentials>({ password: [validators.minLength(8)] })(values);
    if (values.confirm !== values.password) errors.confirm = 'Passwords do not match';
    return errors;
  },
  onSubmit: (values) => save(values),
});
```

`fieldValidators` infers its type from the rules it is given, not from the
values it is later called with, so the form's value type has to be named for a
cross-field rule to typecheck against it.

Errors show only after a field is touched, or after a submit attempt. The
initial values are validated immediately, so `form.valid` is usable for enabling
a submit button from the first frame.
