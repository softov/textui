---
title: Form
parent: Controls and forms
grand_parent: Components
---

<!-- docs:setup
declare const save: (values: unknown) => void; -->

# Form
{: .no_toc }

The context a set of fields share - values, errors and submission.

```tsx
import { Field, Form, TextInput, useForm } from '@textui/widgets';

export function Profile() {
  const form = useForm({
    initialValues: { name: '' },
    onSubmit: (values) => save(values),
  });

  return (
    <Form form={form}>
      <Field name="name" label="Name">
        <TextInput value={String(form.values.name)} onChange={(v) => form.setValue('name', v)} />
      </Field>
    </Form>
  );
}
```

## Props

<!-- props:start -->
| Prop | Type | Default | |
| --- | --- | --- | --- |
| `form` | `FormApi<Record<string, unknown>>` | **required** |  |

Plus everything on [`BoxProps`](../base-props.md).
<!-- props:end -->

Role: `form`.

`Form` carries the `FormApi` from `useForm` down to the [`Field`](field.md)s inside it, so a field can find its own error and touched state by name.

Validation runs over the **whole values object** rather than per field, because the rules people actually need are cross-field - a confirmation that must match a password, a date that must follow another date. Errors show after a field is touched, or after a submit attempt.

## See also

- [Editing keys and selection](editing.md) - the keys, the selection and the clipboard
- [Field](field.md) - one labelled input inside it
- [FormActions](form-actions.md) - the submit row
- [Controls and forms](../input.md) - `validators` and `fieldValidators`
