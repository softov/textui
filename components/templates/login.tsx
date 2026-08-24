import { defineComponent } from '@textui/core';
import {
  Alert,
  Button,
  Center,
  Column,
  Field,
  Form,
  Panel,
  TextInput,
  fieldValidators,
  useForm,
  validators,
} from '@textui/widgets';

/**
 * A sign-in screen.
 *
 * Authentication is a callback rather than a fork in the application: this
 * screen collects credentials and hands them over, and whatever is behind it
 * decides what a session means.
 */
export interface LoginScreenProps {
  title?: string;
  onSubmit?(values: { user: string; password: string }): Promise<void> | void;
  error?: string;
}

export function LoginScreen({ title = 'Sign in', onSubmit, error }: LoginScreenProps) {
  const form = useForm({
    initialValues: { user: '', password: '' },
    validate: fieldValidators({
      user: [validators.required('Enter your user name')],
      password: [validators.required('Enter your password'), validators.minLength(8)],
    }),
    onSubmit: async (values) => {
      await onSubmit?.(values);
    },
  });

  return (
    <Center>
      <Panel title={title} width={46}>
        <Column gap={1} padding={1}>
          {error ? <Alert tone="danger" message={error} /> : null}

          <Form form={form}>
            <Field name="user" label="User" labelWidth={10} required>
              <TextInput
                value={form.values.user}
                autoFocus
                onChange={(v) => {
                  form.setValue('user', v);
                  form.touch('user');
                }}
              />
            </Field>

            <Field name="password" label="Password" labelWidth={10} required>
              <TextInput
                value={form.values.password}
                mask="*"
                onChange={(v) => {
                  form.setValue('password', v);
                  form.touch('password');
                }}
                onSubmit={() => void form.submit()}
              />
            </Field>

            <Button
              label={form.submitting ? 'Signing in…' : 'Sign in'}
              tone="primary"
              variant="solid"
              disabled={form.submitting}
              onPress={() => void form.submit()}
            />
          </Form>
        </Column>
      </Panel>
    </Center>
  );
}

export default defineComponent('LoginScreen', LoginScreen);
