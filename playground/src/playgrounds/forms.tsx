import {
  Column, Field, Form, FormActions, FormSection, KeyValue, Panel, Row,
  RadioGroup, Slider, Switch, TextInput,
  fieldValidators, useForm, validators,
} from '@textui/core';

/**
 * Forms.
 *
 * Two things to look at.
 *
 * The cross-field rule: "confirm must match password" cannot be written as a
 * per-field validator, so validation runs over the whole values object and
 * fields subscribe to the errors that name them.
 *
 * And the two ways to put a label on a control, which are both here because
 * having both and showing one is how you end up thinking a control cannot
 * label itself. A control's own `label` draws it inside the frame; `Field`
 * draws it in a gutter to the left and adds the error and hint lines under
 * it. They are for different jobs and they do not stack - a `Field` around a
 * control that labels itself says the same word twice, which is what
 * `hideLabel` is for.
 */
export function FormsPlayground() {
  const form = useForm({
    initialValues: {
      name: '',
      email: '',
      password: '',
      confirm: '',
      role: 'viewer',
      replicas: 3,
      notify: true,
      host: '',
      port: '8443',
    },
    validate: (values) => {
      const errors = fieldValidators<typeof values>({
        name: [validators.required('A name is required'), validators.minLength(2)],
        email: [validators.required('An email is required'), validators.pattern(/^[^@\s]+@[^@\s]+$/, 'That is not an email')],
        password: [validators.required('Choose a password'), validators.minLength(8)],
        replicas: [validators.range(1, 10)],
      })(values);

      if (values.password !== '' && values.confirm !== values.password) {
        errors.confirm = 'Passwords do not match';
      }
      return errors;
    },
    onSubmit: () => {},
  });

  const bind = (field: 'name' | 'email' | 'password' | 'confirm') => ({
    value: form.values[field],
    onChange: (value: string) => {
      form.setValue(field, value);
      form.touch(field);
    },
  });

  return (
    <Column flex={1} gap={1} padding={1}>
      <Panel title="Account" flex={1}>
        <Form form={form}>
          <FormSection title="Identity" description="How this account is addressed.">
            <Field name="name" label="Name" labelWidth={12} required>
              <TextInput {...bind('name')} autoFocus />
            </Field>
            <Field name="email" label="Email" labelWidth={12} required>
              <TextInput {...bind('email')} />
            </Field>
          </FormSection>

          <FormSection title="Credentials">
            <Field name="password" label="Password" labelWidth={12} required hint="At least 8 characters">
              <TextInput {...bind('password')} mask="*" />
            </Field>
            <Field name="confirm" label="Confirm" labelWidth={12} required>
              <TextInput {...bind('confirm')} mask="*" />
            </Field>
          </FormSection>

          <FormSection title="Options">
            <Field name="role" label="Role" labelWidth={12}>
              <RadioGroup
                inline
                options={[
                  { value: 'viewer', label: 'viewer' },
                  { value: 'operator', label: 'operator' },
                  { value: 'admin', label: 'admin' },
                ]}
                value={form.values.role}
                onChange={(v) => form.setValue('role', v)}
              />
            </Field>
            <Field name="replicas" label="Replicas" labelWidth={12}>
              <Slider
                value={form.values.replicas}
                min={1}
                max={10}
                onChange={(v) => form.setValue('replicas', v)}
              />
            </Field>
            <Field name="notify" label="Notify" labelWidth={12}>
              <Switch value={form.values.notify} onChange={(v) => form.setValue('notify', v)} />
            </Field>
          </FormSection>

          <FormActions submitLabel="Create account" onCancel={() => form.reset()} requireDirty />
        </Form>
      </Panel>

      {/*
        * The same fields, labelled the other way.
        *
        * No gutter and no error line: the label lives inside the frame, so
        * the control is one row taller than its text and nothing has to agree
        * on a `labelWidth`. That is the right shape for a toolbar, a filter
        * bar or a dialog with three inputs - and the wrong one for the form
        * above, where a column of labels has to line up and every field needs
        * somewhere to put "That is not an email".
        */}
      <Panel title="The same controls, labelling themselves">
        <Column gap={0}>
          <text
            content="A control's own label sits inside its frame. Field puts it in a gutter and adds the error line - which is why the form above uses one and this does not."
            fg="muted"
            wrap="word"
          />
          <Row gap={1}>
            <TextInput
              label="Host"
              value={String(form.values.host)}
              onChange={(v: string) => form.setValue('host', v)}
              placeholder="api.example.com"
              flex={1}
            />
            <TextInput
              label="Port"
              value={String(form.values.port)}
              onChange={(v: string) => form.setValue('port', v)}
              width={16}
            />
          </Row>
        </Column>
      </Panel>

      <Panel title="Form state">
        <KeyValue
          columns={2}
          items={[
            { label: 'valid', value: String(form.valid), tone: form.valid ? 'success' : 'danger' },
            { label: 'dirty', value: String(form.dirty) },
            { label: 'errors', value: String(Object.keys(form.errors).length) },
            { label: 'touched', value: String(Object.keys(form.touched).length) },
          ]}
        />
      </Panel>
    </Column>
  );
}
