import {
  Column, Field, Form, FormActions, FormSection, KeyValue, Panel,
  RadioGroup, Slider, Switch, TextInput,
  fieldValidators, useForm, validators,
} from '@textui/core';

/**
 * Forms.
 *
 * The cross-field rule is the point: "confirm must match password" cannot be
 * written as a per-field validator, so validation runs over the whole values
 * object and fields subscribe to the errors that name them.
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
