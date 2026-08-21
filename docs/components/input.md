---
title: Controls and forms
parent: Components
nav_order: 3
---

# Controls and forms

What takes input, and the machinery around a screenful of it.

## Controls

`Button` `Checkbox` `Switch` `RadioGroup` `Slider` `TextInput` `Select` `SearchBox`

Every one is focusable and states its own focus ring. A terminal has no hover to
fall back on: if the focused control is not obvious, the interface is unusable.

`TextInput` publishes a real cursor position when the terminal has a cursor, so
the caret is where typing lands rather than a drawn approximation - counting the
label and the search glyph before it, and scrolling the value sideways to keep
the caret in view. `hideLabel` keeps the label as the field's accessible name
without drawing it inside the field, for a form or a dialog that already shows
it.

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
const form = useForm({
  initialValues: { password: '', confirm: '' },
  validate: (values) => {
    const errors = fieldValidators({ password: [validators.minLength(8)] })(values);
    if (values.confirm !== values.password) errors.confirm = 'Passwords do not match';
    return errors;
  },
  onSubmit: (values) => save(values),
});
```

Errors show only after a field is touched, or after a submit attempt. The
initial values are validated immediately, so `form.valid` is usable for enabling
a submit button from the first frame.
