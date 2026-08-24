import { defineComponent, useRuntime, useState } from '@textui/core';
import {
  Column,
  DangerZone,
  Field,
  Form,
  FormSection,
  Panel,
  Select,
  Slider,
  Switch,
  TextInput,
  useForm,
} from '@textui/widgets';

/**
 * A settings screen.
 *
 * Settings are the one place where a change should be visible immediately, so
 * theme and shell write straight through to the application rather than
 * waiting for a save - and everything else is a normal form.
 */
export interface SettingsScreenProps {
  onDelete?(): void;
}

export function SettingsScreen({ onDelete }: SettingsScreenProps) {
  const runtime = useRuntime();
  const app = runtime.app();
  const [theme, setTheme] = useState(app?.theme.id ?? 'dark');
  const [shell, setShell] = useState(app?.activeShell() ?? 'plain');

  const form = useForm({
    initialValues: { endpoint: 'https://api.example.com', timeout: 30, animations: true },
    onSubmit: () => {},
  });

  return (
    <Column flex={1} gap={1} padding={1} overflow="scroll">
      <Panel title="Appearance">
        <Form form={form}>
          <Field name="theme" label="Theme" labelWidth={12}>
            <Select
              options={(app?.themes.list() ?? []).map((t) => ({ value: t.id, label: t.name }))}
              value={theme}
              onChange={(id) => {
                setTheme(id);
                app?.setTheme(id);
              }}
            />
          </Field>

          <Field name="shell" label="Layout" labelWidth={12}>
            <Select
              options={(app?.shells.list() ?? []).map((s) => ({ value: s.id, label: s.title, description: s.description }))}
              value={shell}
              onChange={(id) => {
                setShell(id);
                app?.setShell(id);
              }}
            />
          </Field>

          <Field name="animations" label="Animations" labelWidth={12} hint="Turn off over a slow link">
            <Switch
              value={form.values.animations}
              onChange={(v) => {
                form.setValue('animations', v);
                if (app) app.animation.enabled = v;
              }}
            />
          </Field>
        </Form>
      </Panel>

      <Panel title="Connection">
        <Form form={form}>
          <FormSection title="Endpoint" description="Where this client talks to.">
            <Field name="endpoint" label="URL" labelWidth={12}>
              <TextInput
                value={form.values.endpoint}
                onChange={(v) => form.setValue('endpoint', v)}
              />
            </Field>
            <Field name="timeout" label="Timeout" labelWidth={12}>
              <Slider
                value={form.values.timeout}
                min={5}
                max={120}
                step={5}
                format={(v) => `${v}s`}
                onChange={(v) => form.setValue('timeout', v)}
              />
            </Field>
          </FormSection>
        </Form>
      </Panel>

      <DangerZone
        description="Removing this instance deletes its local state. This cannot be undone."
        actionLabel="Delete instance"
        confirmText="delete"
        onAction={onDelete}
      />
    </Column>
  );
}

export default defineComponent('SettingsScreen', SettingsScreen);
